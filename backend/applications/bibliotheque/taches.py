"""Tâches asynchrones Celery — Bibliothèque de prix LBH.

Étude de prix inversée analytique :
  Formule fondamentale (Cusant & Widloecher, Manuel de l'Étude de Prix, 6e éd., Eyrolles 2023) :
    PV HT = DS × (1 + α_FC + α_Fop) / (1 − α_FG − α_BA)
  Inversée :
    DS = PV × (1 − α_FG − α_BA) / (1 + α_FC + α_Fop)
  Décomposition DS par ratios ARTIPRIX 2025 par corps d'état.
"""

from __future__ import annotations

import logging
from decimal import Decimal, ROUND_HALF_UP
from urllib.parse import urljoin

from celery import shared_task
from django.core.cache import cache

journal = logging.getLogger(__name__)

# ============================================================
# Clés cache Redis pour le suivi de progression
# ============================================================

def cle_progression(tache_id: str) -> str:
    return f"recalcul_biblio:{tache_id}:progression"

def cle_resultat(tache_id: str) -> str:
    return f"recalcul_biblio:{tache_id}:resultat"

TTL_PROGRESSION = 3600  # 1 heure


# ============================================================
# Tables de coefficients par corps d'état / famille
# (Manuel Étude de Prix Cusant & Widloecher 6e éd. + ARTIPRIX 2025)
# ============================================================

# α_FC  = frais de chantier en % DS
# α_Fop = frais d'opération en % DS
# α_FG  = frais généraux en % PV HT
# α_BA  = bénéfice & aléas en % PV HT
# DS = PV × (1 − α_FG − α_BA) / (1 + α_FC + α_Fop)
COEFFICIENTS_PAR_CORPS_ETAT: dict[str, tuple[float, float, float, float]] = {
    "gros_oeuvre":          (0.10, 0.015, 0.10, 0.06),   # DS/PV ≈ 0.754
    "beton":                (0.10, 0.015, 0.10, 0.06),
    "maconnerie":           (0.09, 0.015, 0.10, 0.06),   # DS/PV ≈ 0.765
    "fondations":           (0.10, 0.015, 0.10, 0.06),
    "terrassements":        (0.12, 0.020, 0.09, 0.05),   # DS/PV ≈ 0.727
    "vrd":                  (0.12, 0.020, 0.09, 0.05),
    "assainissement":       (0.12, 0.020, 0.09, 0.05),
    "voirie":               (0.12, 0.020, 0.09, 0.05),
    "charpente_bois":       (0.08, 0.015, 0.10, 0.06),   # DS/PV ≈ 0.776
    "charpente_metallique": (0.08, 0.015, 0.10, 0.06),
    "couverture":           (0.09, 0.015, 0.10, 0.06),   # DS/PV ≈ 0.765
    "zinguerie":            (0.09, 0.015, 0.10, 0.06),
    "etancheite":           (0.09, 0.015, 0.10, 0.06),
    "facades":              (0.08, 0.015, 0.10, 0.06),
    "bardage":              (0.08, 0.015, 0.10, 0.06),
    "isolation":            (0.06, 0.010, 0.10, 0.06),   # DS/PV ≈ 0.800
    "platrerie":            (0.06, 0.010, 0.10, 0.06),
    "peinture":             (0.05, 0.010, 0.10, 0.06),   # DS/PV ≈ 0.808
    "menuiseries_ext":      (0.07, 0.010, 0.11, 0.07),   # DS/PV ≈ 0.778
    "menuiseries_int":      (0.07, 0.010, 0.11, 0.07),
    "serrurerie":           (0.07, 0.010, 0.11, 0.07),
    "carrelage":            (0.07, 0.010, 0.11, 0.07),
    "revetements":          (0.07, 0.010, 0.11, 0.07),
    "parquet":              (0.07, 0.010, 0.11, 0.07),
    "electricite":          (0.06, 0.010, 0.12, 0.07),   # DS/PV ≈ 0.784
    "courants_forts":       (0.06, 0.010, 0.12, 0.07),
    "courants_faibles":     (0.06, 0.010, 0.12, 0.07),
    "plomberie":            (0.07, 0.015, 0.11, 0.06),   # DS/PV ≈ 0.781
    "sanitaires":           (0.07, 0.015, 0.11, 0.06),
    "chauffage":            (0.07, 0.015, 0.11, 0.06),
    "ventilation":          (0.07, 0.015, 0.11, 0.06),
    "climatisation":        (0.07, 0.015, 0.11, 0.06),
    "cvc":                  (0.07, 0.015, 0.11, 0.06),
    "ascenseur":            (0.05, 0.010, 0.12, 0.07),   # DS/PV ≈ 0.784
    "paysager":             (0.08, 0.015, 0.09, 0.05),   # DS/PV ≈ 0.793
    "espaces_verts":        (0.08, 0.015, 0.09, 0.05),
    "espaces_urbains":      (0.10, 0.020, 0.09, 0.05),
    "demolition":           (0.10, 0.020, 0.08, 0.05),
    "defaut":               (0.08, 0.015, 0.10, 0.06),   # DS/PV ≈ 0.765
}

# Ratios de décomposition DS → (MO%, Matériaux%, Matériel%, Frais_divers%)
# Source : ARTIPRIX 2025, bordereaux moyens par corps d'état
RATIOS_DECOMPOSITION_DS: dict[str, tuple[float, float, float, float]] = {
    "gros_oeuvre":          (0.32, 0.48, 0.15, 0.05),
    "beton":                (0.30, 0.50, 0.15, 0.05),
    "maconnerie":           (0.35, 0.50, 0.10, 0.05),
    "fondations":           (0.28, 0.45, 0.22, 0.05),
    "terrassements":        (0.20, 0.28, 0.49, 0.03),
    "vrd":                  (0.25, 0.38, 0.33, 0.04),
    "assainissement":       (0.28, 0.40, 0.28, 0.04),
    "voirie":               (0.22, 0.35, 0.40, 0.03),
    "charpente_bois":       (0.35, 0.52, 0.08, 0.05),
    "charpente_metallique": (0.25, 0.60, 0.10, 0.05),
    "couverture":           (0.35, 0.52, 0.08, 0.05),
    "zinguerie":            (0.38, 0.52, 0.05, 0.05),
    "etancheite":           (0.30, 0.58, 0.07, 0.05),
    "facades":              (0.30, 0.55, 0.10, 0.05),
    "bardage":              (0.28, 0.57, 0.10, 0.05),
    "isolation":            (0.40, 0.50, 0.05, 0.05),
    "platrerie":            (0.42, 0.48, 0.05, 0.05),
    "peinture":             (0.55, 0.38, 0.02, 0.05),
    "menuiseries_ext":      (0.22, 0.68, 0.05, 0.05),
    "menuiseries_int":      (0.28, 0.62, 0.05, 0.05),
    "serrurerie":           (0.30, 0.60, 0.05, 0.05),
    "carrelage":            (0.42, 0.52, 0.00, 0.06),
    "revetements":          (0.42, 0.52, 0.00, 0.06),
    "parquet":              (0.35, 0.58, 0.02, 0.05),
    "electricite":          (0.38, 0.52, 0.05, 0.05),
    "courants_forts":       (0.38, 0.52, 0.05, 0.05),
    "courants_faibles":     (0.40, 0.50, 0.05, 0.05),
    "plomberie":            (0.32, 0.58, 0.05, 0.05),
    "sanitaires":           (0.30, 0.60, 0.05, 0.05),
    "chauffage":            (0.28, 0.60, 0.07, 0.05),
    "ventilation":          (0.30, 0.58, 0.07, 0.05),
    "climatisation":        (0.28, 0.60, 0.07, 0.05),
    "cvc":                  (0.28, 0.60, 0.07, 0.05),
    "ascenseur":            (0.20, 0.70, 0.05, 0.05),
    "paysager":             (0.45, 0.32, 0.18, 0.05),
    "espaces_verts":        (0.45, 0.35, 0.15, 0.05),
    "espaces_urbains":      (0.30, 0.35, 0.30, 0.05),
    "demolition":           (0.35, 0.15, 0.45, 0.05),
    "defaut":               (0.33, 0.50, 0.12, 0.05),
}

# Taux horaire MO de référence (€/h, charges comprises) — ARTIPRIX 2025
TAUX_HORAIRE_MO_REFERENCE: dict[str, Decimal] = {
    "gros_oeuvre":          Decimal("44.00"),
    "beton":                Decimal("44.00"),
    "maconnerie":           Decimal("43.00"),
    "fondations":           Decimal("44.00"),
    "terrassements":        Decimal("42.00"),
    "vrd":                  Decimal("42.00"),
    "assainissement":       Decimal("42.00"),
    "voirie":               Decimal("41.00"),
    "charpente_bois":       Decimal("46.00"),
    "charpente_metallique": Decimal("48.00"),
    "couverture":           Decimal("46.00"),
    "zinguerie":            Decimal("47.00"),
    "etancheite":           Decimal("46.00"),
    "facades":              Decimal("44.00"),
    "bardage":              Decimal("46.00"),
    "isolation":            Decimal("43.00"),
    "platrerie":            Decimal("43.00"),
    "peinture":             Decimal("42.00"),
    "menuiseries_ext":      Decimal("48.00"),
    "menuiseries_int":      Decimal("46.00"),
    "serrurerie":           Decimal("48.00"),
    "carrelage":            Decimal("44.00"),
    "revetements":          Decimal("43.00"),
    "parquet":              Decimal("44.00"),
    "electricite":          Decimal("52.00"),
    "courants_forts":       Decimal("52.00"),
    "courants_faibles":     Decimal("54.00"),
    "plomberie":            Decimal("52.00"),
    "sanitaires":           Decimal("52.00"),
    "chauffage":            Decimal("53.00"),
    "ventilation":          Decimal("52.00"),
    "climatisation":        Decimal("54.00"),
    "cvc":                  Decimal("53.00"),
    "ascenseur":            Decimal("56.00"),
    "paysager":             Decimal("40.00"),
    "espaces_verts":        Decimal("40.00"),
    "espaces_urbains":      Decimal("41.00"),
    "demolition":           Decimal("41.00"),
    "defaut":               Decimal("44.00"),
}

D4 = Decimal("0.0001")


def _normaliser_cle_corps_etat(corps_etat: str, famille: str = "") -> str:
    """Normalise un corps d'état ou famille en clé de table de coefficients."""
    texte = (corps_etat or famille or "").lower()
    texte = (
        texte.replace("é", "e").replace("è", "e").replace("ê", "e")
        .replace("à", "a").replace("â", "a").replace("ô", "o")
        .replace("î", "i").replace("ù", "u").replace("û", "u").replace("ç", "c")
        .replace(" ", "_").replace("-", "_").replace("/", "_")
        .replace("'", "").replace("&", "").replace(".", "")
    )
    mappings = [
        ("gros_oeuvre", "gros_oeuvre"), ("go_beton", "gros_oeuvre"),
        ("terrassement", "terrassements"), ("excavation", "terrassements"),
        ("vrd", "vrd"), ("reseaux", "vrd"),
        ("assainissement", "assainissement"),
        ("voirie", "voirie"), ("amenagement_exterieur", "vrd"),
        ("fondation", "fondations"), ("semelle", "fondations"),
        ("maconnerie", "maconnerie"), ("brique", "maconnerie"),
        ("beton", "beton"), ("dalle", "beton"), ("poteau", "beton"), ("poutre", "beton"),
        ("charpente_metall", "charpente_metallique"),
        ("charpente", "charpente_bois"), ("ossature_bois", "charpente_bois"),
        ("couverture", "couverture"), ("toiture", "couverture"),
        ("zinguerie", "zinguerie"), ("gouttiere", "zinguerie"),
        ("etancheite", "etancheite"),
        ("facade", "facades"), ("bardage", "bardage"), ("ite", "facades"),
        ("isolation", "isolation"),
        ("platrerie", "platrerie"), ("cloison", "platrerie"), ("doublage", "platrerie"),
        ("peinture", "peinture"), ("revetement_mural", "peinture"),
        ("menuiserie_ext", "menuiseries_ext"), ("fenetre", "menuiseries_ext"),
        ("menuiserie_int", "menuiseries_int"), ("porte_int", "menuiseries_int"),
        ("serrurerie", "serrurerie"), ("garde_corps", "serrurerie"),
        ("carrelage", "carrelage"), ("faience", "carrelage"),
        ("parquet", "parquet"), ("stratifie", "parquet"),
        ("revetement_sol", "revetements"), ("moquette", "revetements"),
        ("electricite", "electricite"), ("courant_fort", "courants_forts"),
        ("eclairage", "electricite"),
        ("courant_faible", "courants_faibles"), ("alarme", "courants_faibles"),
        ("plomberie", "plomberie"), ("sanitaire", "sanitaires"),
        ("chauffage", "chauffage"), ("radiateur", "chauffage"),
        ("ventilation", "ventilation"), ("vmc", "ventilation"),
        ("climatisation", "climatisation"), ("cvc", "cvc"),
        ("ascenseur", "ascenseur"), ("monte_charge", "ascenseur"),
        ("paysager", "paysager"), ("espace_vert", "espaces_verts"),
        ("demolition", "demolition"), ("depose", "demolition"),
    ]
    for motif, cle in mappings:
        if motif in texte:
            return cle
    return "defaut"


def calculer_ds_depuis_pv(prix_vente: Decimal, corps_etat: str, famille: str = "") -> Decimal:
    """
    DS = PV × (1 − α_FG − α_BA) / (1 + α_FC + α_Fop)
    (Manuel Étude de Prix, Cusant & Widloecher, 6e éd.)
    """
    if not prix_vente or prix_vente <= 0:
        return Decimal("0")
    cle = _normaliser_cle_corps_etat(corps_etat, famille)
    alpha_fc, alpha_fop, alpha_fg, alpha_ba = COEFFICIENTS_PAR_CORPS_ETAT.get(
        cle, COEFFICIENTS_PAR_CORPS_ETAT["defaut"]
    )
    numerateur = Decimal(str(1 - alpha_fg - alpha_ba))
    denominateur = Decimal(str(1 + alpha_fc + alpha_fop))
    return (prix_vente * numerateur / denominateur).quantize(D4, rounding=ROUND_HALF_UP)


def decomposer_ds_en_composantes(
    ds: Decimal,
    corps_etat: str,
    famille: str = "",
    cout_horaire_existant: Decimal | None = None,
) -> dict[str, Decimal]:
    """
    Répartit DS en composantes (MO, matériaux, matériel, frais divers)
    selon les ratios ARTIPRIX 2025 par corps d'état.
    """
    if ds <= 0:
        return {
            "cout_matieres": Decimal("0"), "cout_materiel": Decimal("0"),
            "cout_frais_divers": Decimal("0"), "cout_sous_traitance": Decimal("0"),
            "cout_transport": Decimal("0"), "debourse_sec_unitaire": Decimal("0"),
            "temps_main_oeuvre": Decimal("0"), "cout_horaire_mo": Decimal("0"),
        }
    cle = _normaliser_cle_corps_etat(corps_etat, famille)
    ratio_mo, ratio_mat, ratio_mtl, ratio_frais = RATIOS_DECOMPOSITION_DS.get(
        cle, RATIOS_DECOMPOSITION_DS["defaut"]
    )
    montant_mo = (ds * Decimal(str(ratio_mo))).quantize(D4, rounding=ROUND_HALF_UP)
    montant_mat = (ds * Decimal(str(ratio_mat))).quantize(D4, rounding=ROUND_HALF_UP)
    montant_mtl = (ds * Decimal(str(ratio_mtl))).quantize(D4, rounding=ROUND_HALF_UP)
    montant_frais = (ds * Decimal(str(ratio_frais))).quantize(D4, rounding=ROUND_HALF_UP)
    # Ajustement pour que la somme soit exactement DS
    ecart = ds - (montant_mo + montant_mat + montant_mtl + montant_frais)
    montant_mat = (montant_mat + ecart).quantize(D4, rounding=ROUND_HALF_UP)

    th = cout_horaire_existant or TAUX_HORAIRE_MO_REFERENCE.get(cle, Decimal("44.00"))
    temps_mo = (montant_mo / th).quantize(D4, rounding=ROUND_HALF_UP) if th > 0 else Decimal("0")

    return {
        "cout_matieres": montant_mat,
        "cout_materiel": montant_mtl,
        "cout_frais_divers": montant_frais,
        "cout_sous_traitance": Decimal("0"),
        "cout_transport": Decimal("0"),
        "debourse_sec_unitaire": ds,
        "temps_main_oeuvre": temps_mo,
        "cout_horaire_mo": th,
    }


def recalculer_ligne_inverse(ligne) -> tuple[dict[str, Decimal], str]:
    """
    Recalcule une ligne par étude de prix inversée avec 3 stratégies :

    1. Sous-détails existants → recalcul classique.
       Si PV connu et écart DS/PV > 30% → affinage par interpolation.
    2. PV connu, pas de sous-détails → DS = PV × Kpv inverse + décomposition statistique.
    3. Ni sous-détails ni PV → ignorée.
    """
    from applications.bibliotheque.services import recalculer_composantes_depuis_sous_details

    a_sous_details = ligne.sous_details.exists()
    pv = ligne.prix_vente_unitaire or Decimal("0")

    if a_sous_details:
        composantes = recalculer_composantes_depuis_sous_details(ligne)
        ds_calcule = composantes.get("debourse_sec_unitaire", Decimal("0"))

        if pv > 0 and ds_calcule > 0:
            ds_theorique = calculer_ds_depuis_pv(pv, ligne.corps_etat or "", ligne.famille or "")
            if ds_theorique > 0:
                ecart_relatif = abs(ds_calcule - ds_theorique) / ds_theorique
                if ecart_relatif > Decimal("0.30"):
                    ds_final = (ds_calcule * Decimal("0.7") + ds_theorique * Decimal("0.3")).quantize(D4)
                    affines = decomposer_ds_en_composantes(
                        ds_final, ligne.corps_etat or "", ligne.famille or "",
                        cout_horaire_existant=composantes.get("cout_horaire_mo"),
                    )
                    affines["temps_main_oeuvre"] = composantes["temps_main_oeuvre"]
                    affines["cout_horaire_mo"] = composantes["cout_horaire_mo"]
                    return affines, "affinees"

        return composantes, "sous_details"

    elif pv > 0:
        ds = calculer_ds_depuis_pv(pv, ligne.corps_etat or "", ligne.famille or "")
        th_existant = ligne.cout_horaire_mo if ligne.cout_horaire_mo and ligne.cout_horaire_mo > 0 else None
        composantes = decomposer_ds_en_composantes(
            ds, ligne.corps_etat or "", ligne.famille or "",
            cout_horaire_existant=th_existant,
        )
        return composantes, "inversees"

    return {}, "ignorees"


# ============================================================
# Tâche Celery — Recalcul global de la bibliothèque
# ============================================================

@shared_task(
    name="bibliotheque.recalculer_bibliotheque",
    bind=True,
    max_retries=0,
    soft_time_limit=3600,
)
def tache_recalculer_bibliotheque(
    self,
    tache_id: str,
    filtre_statut: str | None = None,
    filtre_famille: str | None = None,
) -> dict:
    """
    Recalcule toute la bibliothèque de manière asynchrone avec suivi Redis.
    Progression accessible via GET /api/bibliotheque/progression-recalcul/<tache_id>/
    """
    from applications.bibliotheque.models import LignePrixBibliotheque

    def publier(traites: int, total: int, message: str = "") -> None:
        pct = int(traites / total * 100) if total > 0 else 0
        cache.set(cle_progression(tache_id), {
            "statut": "en_cours", "traites": traites, "total": total,
            "pourcentage": pct, "message": message,
        }, timeout=TTL_PROGRESSION)

    cache.set(cle_progression(tache_id), {
        "statut": "en_cours", "traites": 0, "total": 0,
        "pourcentage": 0, "message": "Initialisation...",
    }, timeout=TTL_PROGRESSION)

    qs = LignePrixBibliotheque.objects.all()
    if filtre_statut:
        qs = qs.filter(statut_validation=filtre_statut)
    if filtre_famille:
        qs = qs.filter(famille__iexact=filtre_famille)

    ids = list(qs.values_list("id", flat=True))
    total = len(ids)
    compteurs: dict[str, int] = {"sous_details": 0, "inversees": 0, "affinees": 0, "ignorees": 0, "erreurs": 0}

    for i, pk in enumerate(ids):
        try:
            ligne = LignePrixBibliotheque.objects.prefetch_related("sous_details").get(pk=pk)
            composantes, methode = recalculer_ligne_inverse(ligne)
            if composantes:
                for champ, valeur in composantes.items():
                    setattr(ligne, champ, valeur)
                ligne.save(update_fields=list(composantes.keys()) + ["date_modification"])
            compteurs[methode if methode in compteurs else "inversees"] += 1
        except Exception as exc:
            journal.warning("Erreur recalcul ligne %s : %s", pk, exc)
            compteurs["erreurs"] += 1

        if (i + 1) % 50 == 0 or (i + 1) == total:
            publier(i + 1, total,
                f"{i + 1}/{total} lignes — {compteurs['inversees']} inversées, "
                f"{compteurs['sous_details']} depuis sous-détails"
            )

    resultat = {
        "statut": "termine",
        "total": total,
        "lignes_recalculees": compteurs["sous_details"],
        "lignes_inversees": compteurs["inversees"],
        "lignes_affinees": compteurs["affinees"],
        "lignes_ignorees": compteurs["ignorees"],
        "lignes_en_erreur": compteurs["erreurs"],
        "pourcentage": 100,
        "message": f"Terminé — {total} lignes traitées.",
    }
    cache.set(cle_progression(tache_id), {**resultat, "traites": total}, timeout=TTL_PROGRESSION)
    cache.set(cle_resultat(tache_id), resultat, timeout=TTL_PROGRESSION)
    journal.info("Recalcul bibliothèque terminé : %s", resultat)
    return resultat


# ============================================================
# Tâche Celery — Recalcul d'une ligne individuelle
# ============================================================

@shared_task(name="bibliotheque.recalculer_ligne", max_retries=2)
def tache_recalculer_ligne(ligne_prix_id: str) -> dict:
    """Recalcule une seule ligne par étude inversée ou depuis ses sous-détails."""
    from applications.bibliotheque.models import LignePrixBibliotheque
    try:
        ligne = LignePrixBibliotheque.objects.prefetch_related("sous_details").get(pk=ligne_prix_id)
        composantes, methode = recalculer_ligne_inverse(ligne)
        if composantes:
            for champ, valeur in composantes.items():
                setattr(ligne, champ, valeur)
            ligne.save(update_fields=list(composantes.keys()) + ["date_modification"])
            return {
                "traite": ligne_prix_id,
                "methode": methode,
                "debourse_sec_unitaire": str(composantes.get("debourse_sec_unitaire", "0")),
            }
        return {"traite": ligne_prix_id, "methode": "ignoree"}
    except Exception as exc:
        journal.error("Erreur recalcul ligne %s : %s", ligne_prix_id, exc)
        raise


# ============================================================
# Tâche Celery — Téléchargement des illustrations
# ============================================================

@shared_task(name="bibliotheque.telecharger_illustrations")
def telecharger_illustrations_ligne_prix(ligne_prix_id: str) -> dict:
    """Télécharge et stocke les URLs d'illustrations d'une ligne depuis son URL source."""
    import requests
    from lxml import html as lxml_html
    from .models import LignePrixBibliotheque

    try:
        ligne = LignePrixBibliotheque.objects.get(id=ligne_prix_id)
    except LignePrixBibliotheque.DoesNotExist:
        return {"erreur": f"Ligne {ligne_prix_id} introuvable"}

    if not ligne.url_source:
        return {"erreur": "Pas d'URL source"}

    try:
        r = requests.get(
            ligne.url_source,
            headers={"User-Agent": "Plateforme-LBH/1.0", "Accept-Language": "fr-FR,fr;q=0.9"},
            timeout=30,
        )
        r.raise_for_status()
        r.encoding = "utf-8"
        document = lxml_html.fromstring(r.content)
    except Exception as exc:
        return {"erreur": f"Erreur réseau : {exc}"}

    urls_trouvees: list[str] = []
    vues: set[str] = set()

    for src in document.xpath(
        '//div[contains(@class,"illustration") or contains(@id,"illustration")'
        ' or contains(@class,"image-produit")]//img/@src'
    ):
        if src and not src.startswith("data:"):
            absolu = urljoin(ligne.url_source, src)
            if absolu not in vues:
                vues.add(absolu)
                urls_trouvees.append(absolu)

    for src in document.xpath("//article//img/@src | //div[contains(@class,'card-body')]//img/@src"):
        if src and not src.startswith("data:"):
            ext = src.split("?")[0].lower().rsplit(".", 1)[-1] if "." in src else ""
            if ext in ("png", "jpg", "jpeg", "webp", "gif"):
                absolu = urljoin(ligne.url_source, src)
                if absolu not in vues:
                    vues.add(absolu)
                    urls_trouvees.append(absolu)

    if not urls_trouvees:
        return {"traite": ligne_prix_id, "illustrations": 0}

    existantes = list(ligne.illustrations or [])
    for url_img in urls_trouvees[:5]:
        if url_img not in existantes:
            existantes.append(url_img)

    ligne.illustrations = existantes
    ligne.save(update_fields=["illustrations"])
    return {"traite": ligne_prix_id, "illustrations": len(existantes)}


# ============================================================
# Tâche Celery — Liaison automatique prix ↔ articles CCTP
# ============================================================

@shared_task(name="bibliotheque.lier_auto_prix_articles")
def tache_lier_auto_prix_articles() -> dict:
    """
    Lie automatiquement les lignes de la bibliothèque aux articles CCTP
    par similarité de désignation (mots significatifs > 4 caractères).
    Planifiée quotidiennement par Celery Beat (3h30).
    """
    from applications.pieces_ecrites.models import ArticleCCTP
    from .models import LignePrixBibliotheque

    articles_sans_liaison = list(
        ArticleCCTP.objects.filter(
            ligne_prix_reference__isnull=True,
            est_dans_bibliotheque=True,
        ).values("id", "intitule")
    )

    lignes_prix = list(
        LignePrixBibliotheque.objects.filter(
            statut_validation__in=("valide", "a_valider")
        ).values("id", "designation_courte", "designation_longue")
    )

    def _mots(texte: str) -> set:
        if not texte:
            return set()
        return {m.lower() for m in texte.replace("-", " ").split() if len(m) > 4}

    liaisons_creees = 0
    for article_data in articles_sans_liaison:
        mots_article = _mots(article_data["intitule"])
        if len(mots_article) < 2:
            continue

        meilleure_id = None
        meilleur_score = 2  # score minimal pour matcher

        for ligne in lignes_prix:
            mots_ligne = _mots(
                (ligne["designation_courte"] or "") + " " + (ligne["designation_longue"] or "")
            )
            score = len(mots_article & mots_ligne)
            if score > meilleur_score:
                meilleur_score = score
                meilleure_id = ligne["id"]

        if meilleure_id:
            try:
                article = ArticleCCTP.objects.get(pk=article_data["id"])
                article.ligne_prix_reference_id = meilleure_id
                article.save(update_fields=["ligne_prix_reference"])
                liaisons_creees += 1
            except ArticleCCTP.DoesNotExist:
                pass

    journal.info("Liaison auto prix↔CCTP : %d liaisons créées sur %d articles traités.",
                 liaisons_creees, len(articles_sans_liaison))
    return {
        "articles_traites": len(articles_sans_liaison),
        "liaisons_creees": liaisons_creees,
    }
