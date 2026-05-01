"""
Services métier — Module Société.
"""

from __future__ import annotations

import uuid
from decimal import Decimal, ROUND_HALF_UP
from html import escape
from typing import Any

from django.template.loader import render_to_string

from applications.projets.models import MissionClient
from applications.site_public.models import ConfigurationSite


def calculer_fiche_salaire(
    *,
    salaire_net: Any,
    primes: Any = 0,
    avantages: Any = 0,
    taux_sal: Any,
    taux_pat: Any,
    heures_an: Any,
    taux_marge: Any = 0,
    coefficient_k: Any = 1,
    heures_facturables_jour: Any = 7,
) -> dict[str, Any]:
    """
    Calcule la fiche de paie analytique depuis le salaire net mensuel.
    Reproduit la logique Excel 02_Param_BE :
      Brut = (Net + primes + avantages) / (1 - taux_sal)
      Charges_pat = Brut × taux_pat
      Coût_annuel = (Brut + Charges_pat) × 12
      Coût direct horaire = Coût_annuel / heures_an
      Taux de vente = Coût direct horaire × coefficient K

    Le calcul historique DHMO / (1 - marge) est conservé dans la sortie pour
    compatibilité, mais il n'est plus la logique principale de vente.
    """
    def d(v) -> Decimal:
        return Decimal(str(v))

    net = d(salaire_net)
    pr = d(primes)
    av = d(avantages)
    ts = d(taux_sal)
    tp = d(taux_pat)
    h = d(heures_an)
    tm = d(taux_marge)
    k = d(coefficient_k)
    heures_jour = d(heures_facturables_jour)

    base_remuneration = net + pr + av
    brut = (base_remuneration / (1 - ts)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    charges_sal = (brut - base_remuneration).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    charges_pat = (brut * tp).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    cout_mensuel = (brut + charges_pat).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    cout_annuel = (cout_mensuel * 12).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    cout_direct_horaire = (cout_annuel / h).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP) if h > 0 else Decimal("0.0000")
    taux_vente = (cout_direct_horaire * k).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
    taux_vente_historique = (
        (cout_direct_horaire / (1 - tm)).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
        if tm < 1
        else Decimal("0.0000")
    )
    forfait_jour = (taux_vente * heures_jour).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    return {
        "salaire_net_mensuel": net,
        "primes_mensuelles": pr,
        "avantages_mensuels": av,
        "salaire_brut_estime": brut,
        "charges_salariales": charges_sal,
        "charges_patronales": charges_pat,
        "cout_employeur_mensuel": cout_mensuel,
        "cout_annuel": cout_annuel,
        "heures_productives_an": h,
        "dhmo": cout_direct_horaire,
        "cout_direct_horaire": cout_direct_horaire,
        "taux_marge_vente": tm,
        "taux_vente_horaire": taux_vente,
        "taux_vente_horaire_historique": taux_vente_historique,
        "taux_vente_horaire_calcule_k": taux_vente,
        "forfait_jour_ht_calcule": forfait_jour,
    }


def _d(valeur: Any, defaut: str = "0") -> Decimal:
    if valeur is None or valeur == "":
        return Decimal(defaut)
    return Decimal(str(valeur))


def _q(valeur: Decimal, precision: str = "0.01") -> Decimal:
    return valeur.quantize(Decimal(precision), rounding=ROUND_HALF_UP)


def parametre_societe_courant(annee: int | None = None):
    from applications.societe.models import ParametreSociete

    qs = ParametreSociete.objects.all()
    if annee:
        parametre = qs.filter(annee=annee).first()
        if parametre:
            return parametre
    return qs.order_by("-annee").first()


def arrondir_tarif(valeur: Any, mode: str = "aucun", pas: Any = Decimal("1.00")) -> Decimal:
    montant = _d(valeur)
    if mode == "aucun":
        return _q(montant)

    pas_arrondi = {
        "euro": Decimal("1.00"),
        "cinq_euros": Decimal("5.00"),
        "dix_euros": Decimal("10.00"),
    }.get(mode, _d(pas, "1.00"))
    if pas_arrondi <= 0:
        pas_arrondi = Decimal("1.00")
    unite = (montant / pas_arrondi).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    return _q(unite * pas_arrondi)


def calculer_cout_direct_annuel_profils(profils) -> Decimal:
    total = Decimal("0.00")
    for profil in profils:
        simulations = list(profil.simulations.filter(actif=True))
        if simulations:
            total += sum((simulation.cout_annuel for simulation in simulations), Decimal("0.00"))
        elif profil.cout_direct_horaire and profil.heures_productives_an:
            total += _q(profil.cout_direct_horaire * profil.heures_productives_an)
    return _q(total)


def calculer_coefficient_k_societe(annee: int | None = None) -> dict[str, Any]:
    from applications.societe.models import ChargeFixeStructure, ProfilHoraire

    parametre = parametre_societe_courant(annee)
    profils = ProfilHoraire.objects.filter(actif=True).prefetch_related("simulations")
    cout_direct_annuel = calculer_cout_direct_annuel_profils(profils)
    charges_structure = _q(
        sum((charge.montant_annuel for charge in ChargeFixeStructure.objects.filter(actif=True)), Decimal("0.00"))
    )

    taux_frais_generaux = _d(getattr(parametre, "taux_frais_generaux", 0))
    taux_frais_commerciaux = _d(getattr(parametre, "taux_frais_commerciaux", 0))
    taux_risque_alea = _d(getattr(parametre, "taux_risque_alea", 0))
    taux_imponderables = _d(getattr(parametre, "taux_imponderables", 0))
    taux_marge = _d(getattr(parametre, "taux_marge_cible", getattr(parametre, "objectif_marge_nette", 0)))
    if taux_marge >= 1:
        raise ValueError("Le taux de marge cible doit être inférieur à 100 %.")

    base_frais = cout_direct_annuel + charges_structure
    frais_generaux = _q(base_frais * taux_frais_generaux)
    frais_commerciaux = _q(base_frais * taux_frais_commerciaux)
    risques = _q(base_frais * taux_risque_alea)
    imponderables = _q(base_frais * taux_imponderables)
    cout_complet = _q(cout_direct_annuel + charges_structure + frais_generaux + frais_commerciaux + risques + imponderables)
    ca_cible = _q(cout_complet / (Decimal("1") - taux_marge)) if taux_marge < 1 else Decimal("0.00")
    coefficient_k = (ca_cible / cout_direct_annuel).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP) if cout_direct_annuel > 0 else Decimal("1.0000")

    taux = calculer_taux_moyen_pondere(profils=profils, coefficient_k=coefficient_k, parametre=parametre)
    heures_jour = _d(getattr(parametre, "heures_facturables_jour", 7), "7")
    heures_necessaires = (charges_structure / taux["taux_horaire_moyen_pondere"]).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP) if taux["taux_horaire_moyen_pondere"] > 0 else Decimal("0.00")

    return {
        "annee": getattr(parametre, "annee", annee) if parametre else annee,
        "coefficient_k": coefficient_k,
        "cout_direct_annuel": cout_direct_annuel,
        "charges_structure_annuelles": charges_structure,
        "frais_generaux_annuels": frais_generaux,
        "frais_commerciaux_annuels": frais_commerciaux,
        "risques_annuels": risques,
        "imponderables_annuels": imponderables,
        "cout_complet_annuel": cout_complet,
        "ca_cible_annuel": ca_cible,
        "ca_cible_mensuel": _q(ca_cible / Decimal("12")) if ca_cible else Decimal("0.00"),
        "cout_direct_horaire_moyen_pondere": taux["cout_direct_horaire_moyen_pondere"],
        "taux_horaire_moyen_pondere": taux["taux_horaire_moyen_pondere"],
        "forfait_jour_moyen_ht": taux["forfait_jour_moyen_ht"],
        "heures_facturables_jour": heures_jour,
        "seuil_rentabilite_annuel": charges_structure,
        "seuil_rentabilite_mensuel": _q(charges_structure / Decimal("12")) if charges_structure else Decimal("0.00"),
        "heures_facturables_annuelles_necessaires": heures_necessaires,
        "jours_facturables_annuels_necessaires": _q(heures_necessaires / heures_jour) if heures_jour > 0 else Decimal("0.00"),
        "details": {
            "base_frais": str(base_frais),
            "taux_frais_generaux": str(taux_frais_generaux),
            "taux_frais_commerciaux": str(taux_frais_commerciaux),
            "taux_risque_alea": str(taux_risque_alea),
            "taux_imponderables": str(taux_imponderables),
            "taux_marge_cible": str(taux_marge),
        },
    }


def calculer_taux_moyen_pondere(*, profils, coefficient_k: Any, parametre=None) -> dict[str, Decimal]:
    k = _d(coefficient_k, "1")
    heures_jour = _d(getattr(parametre, "heures_facturables_jour", 7), "7")
    total_pondere = Decimal("0.0000")
    total_poids = Decimal("0.0000")

    for profil in profils:
        if not profil.actif or not getattr(profil, "inclure_taux_moyen", True):
            continue
        cout_direct = _d(getattr(profil, "cout_direct_horaire", 0))
        if cout_direct <= 0:
            simulations = list(profil.simulations.filter(actif=True))
            if simulations:
                cout_direct = sum((simulation.cout_direct_horaire for simulation in simulations), Decimal("0.0000")) / len(simulations)
        if cout_direct <= 0:
            continue
        poids = _d(getattr(profil, "poids_ponderation", 1), "1")
        if poids <= 0:
            poids = Decimal("1")
        total_pondere += cout_direct * poids
        total_poids += poids

    cout_moyen = (total_pondere / total_poids).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP) if total_poids > 0 else Decimal("0.0000")
    taux_moyen = _q(cout_moyen * k)
    forfait_jour = _q(taux_moyen * heures_jour)
    return {
        "cout_direct_horaire_moyen_pondere": _q(cout_moyen),
        "taux_horaire_moyen_pondere": taux_moyen,
        "forfait_jour_moyen_ht": forfait_jour,
    }


def recalculer_taux_profil(profil) -> None:
    """
    Recalcule le coût direct et le taux de vente du profil avec le coefficient K.
    """
    synthese = calculer_coefficient_k_societe()
    parametre = parametre_societe_courant()
    coefficient_k = synthese["coefficient_k"]
    heures_jour = _d(getattr(parametre, "heures_facturables_jour", 7), "7")
    mode_arrondi = getattr(parametre, "mode_arrondi_tarif", "aucun") if parametre else "aucun"
    pas_arrondi = getattr(parametre, "pas_arrondi_tarif", Decimal("1.00")) if parametre else Decimal("1.00")

    sims = list(profil.simulations.filter(actif=True))
    if sims:
        cout_direct = (sum((s.cout_direct_horaire for s in sims), Decimal("0.0000")) / len(sims)).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
    else:
        cout_direct = _d(getattr(profil, "cout_direct_horaire", 0))

    taux_vente = arrondir_tarif(cout_direct * coefficient_k, mode_arrondi, pas_arrondi)
    forfait_jour = _q(taux_vente * heures_jour)
    champs = {
        "cout_direct_horaire": _q(cout_direct),
        "coefficient_k_applique": coefficient_k,
        "taux_vente_horaire_calcule": taux_vente,
        "forfait_jour_ht_calcule": forfait_jour,
        "taux_horaire_ht_calcule": taux_vente,
    }
    if profil.utiliser_calcul and taux_vente is not None:
        champs["taux_horaire_ht"] = taux_vente

    type(profil).objects.filter(pk=profil.pk).update(**champs)


def recalculer_tarifs_societe(annee: int | None = None) -> dict[str, Any]:
    from applications.societe.models import ProfilHoraire, SimulationSalaire

    synthese = calculer_coefficient_k_societe(annee)
    parametre = parametre_societe_courant(annee)
    heures_jour = _d(getattr(parametre, "heures_facturables_jour", 7), "7")
    coefficient_k = synthese["coefficient_k"]
    for simulation in SimulationSalaire.objects.select_related("profil").filter(actif=True):
        fiche = calculer_fiche_salaire(
            salaire_net=simulation.salaire_net_mensuel,
            primes=simulation.primes_mensuelles,
            avantages=simulation.avantages_mensuels,
            taux_sal=simulation.profil.taux_charges_salariales,
            taux_pat=simulation.profil.taux_charges_patronales,
            heures_an=simulation.profil.heures_productives_an,
            taux_marge=simulation.profil.taux_marge_vente,
            coefficient_k=coefficient_k,
            heures_facturables_jour=heures_jour,
        )
        for champ in ("salaire_brut_estime", "charges_salariales", "charges_patronales", "cout_employeur_mensuel", "cout_annuel", "dhmo", "cout_direct_horaire", "taux_vente_horaire", "taux_vente_horaire_calcule_k", "forfait_jour_ht_calcule"):
            setattr(simulation, champ, fiche[champ])
        SimulationSalaire.objects.filter(pk=simulation.pk).update(
            salaire_brut_estime=simulation.salaire_brut_estime,
            charges_salariales=simulation.charges_salariales,
            charges_patronales=simulation.charges_patronales,
            cout_employeur_mensuel=simulation.cout_employeur_mensuel,
            cout_annuel=simulation.cout_annuel,
            dhmo=simulation.dhmo,
            cout_direct_horaire=simulation.cout_direct_horaire,
            taux_vente_horaire=simulation.taux_vente_horaire,
            taux_vente_horaire_calcule_k=simulation.taux_vente_horaire_calcule_k,
            forfait_jour_ht_calcule=simulation.forfait_jour_ht_calcule,
        )
    for profil in ProfilHoraire.objects.filter(actif=True).prefetch_related("simulations"):
        recalculer_taux_profil(profil)
    return calculer_coefficient_k_societe(annee)


def calculer_ligne_devis(ligne) -> dict[str, Any]:
    parametre = parametre_societe_courant()
    synthese = calculer_coefficient_k_societe(getattr(parametre, "annee", None))
    mode = ligne.mode_chiffrage
    if not mode:
        mode = {
            "horaire": "taux_profil",
            "forfait": "forfait_mission",
            "frais": "frais",
            "sous_traitance": "sous_traitance",
        }.get(ligne.type_ligne, "forfait_mission")

    nb_heures = _d(ligne.nb_heures)
    nb_jours = _d(getattr(ligne, "nb_jours", 0))
    quantite = _d(ligne.quantite, "1")
    montant_unitaire = _d(ligne.montant_unitaire_ht)
    cout_direct_horaire = Decimal("0.00")
    taux_horaire = _d(ligne.taux_horaire)
    forfait_jour = _d(getattr(ligne, "forfait_jour_ht_reference", 0))
    source_tarif = ligne.source_tarif or ""

    if mode == "taux_moyen_be":
        taux_horaire = synthese["taux_horaire_moyen_pondere"]
        cout_direct_horaire = synthese["cout_direct_horaire_moyen_pondere"]
        montant_ht = _q(nb_heures * taux_horaire)
        cout_direct_total = _q(nb_heures * cout_direct_horaire)
        source_tarif = "taux_moyen_be"
    elif mode == "taux_profil":
        profil = ligne.profil
        taux_horaire = _d(getattr(profil, "taux_horaire_ht", ligne.taux_horaire))
        cout_direct_horaire = _d(getattr(profil, "cout_direct_horaire", 0))
        montant_ht = _q(nb_heures * taux_horaire)
        cout_direct_total = _q(nb_heures * cout_direct_horaire)
        source_tarif = "profil"
    elif mode == "forfait_jour_profil":
        profil = ligne.profil
        forfait_jour = _d(getattr(profil, "forfait_jour_ht_calcule", 0))
        cout_direct_horaire = _d(getattr(profil, "cout_direct_horaire", 0))
        heures_jour = _d(getattr(parametre, "heures_facturables_jour", 7), "7")
        montant_ht = _q(nb_jours * forfait_jour)
        cout_direct_total = _q(nb_jours * heures_jour * cout_direct_horaire)
        source_tarif = "forfait_jour_profil"
    else:
        montant_ht = _q(quantite * montant_unitaire)
        cout_direct_total = _q(_d(getattr(ligne, "cout_direct_total_estime", 0)))
        source_tarif = mode

    marge = _q(montant_ht - cout_direct_total)
    taux_marge = (marge / montant_ht).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP) if montant_ht > 0 else Decimal("0.0000")
    return {
        "mode_chiffrage": mode,
        "taux_horaire": _q(taux_horaire) if taux_horaire else ligne.taux_horaire,
        "forfait_jour_ht_reference": _q(forfait_jour) if forfait_jour else None,
        "cout_direct_horaire_reference": _q(cout_direct_horaire) if cout_direct_horaire else None,
        "cout_direct_total_estime": cout_direct_total,
        "coefficient_k_applique": synthese["coefficient_k"],
        "montant_ht": montant_ht,
        "marge_estimee_ht": marge,
        "taux_marge_estime": taux_marge,
        "source_tarif": source_tarif,
    }


def lister_missions_livrables(
    *,
    famille_client: str = "",
    sous_type_client: str = "",
    nature_ouvrage: str = "",
) -> list[dict[str, Any]]:
    missions_qs = MissionClient.objects.filter(est_active=True).select_related("profil_horaire_defaut").prefetch_related("livrables")

    if famille_client:
        missions_qs = missions_qs.filter(famille_client=famille_client)
    if nature_ouvrage:
        missions_qs = missions_qs.filter(nature_ouvrage__in=[nature_ouvrage, "tous"])

    missions: list[dict[str, Any]] = []
    for mission in missions_qs:
        if sous_type_client and mission.sous_types_client and sous_type_client not in mission.sous_types_client:
            continue

        livrables = [
            {
                "id": str(livrable.id),
                "code": livrable.code,
                "libelle": livrable.libelle,
                "type_document": livrable.type_document,
                "format_attendu": livrable.format_attendu,
                "icone": livrable.icone,
                "couleur": livrable.couleur,
            }
            for livrable in mission.livrables.filter(est_active=True).order_by("ordre", "libelle")
        ]

        missions.append({
            "id": str(mission.id),
            "code": mission.code,
            "libelle": mission.libelle,
            "description": mission.description,
            "famille_client": mission.famille_client,
            "nature_ouvrage": mission.nature_ouvrage,
            "phases_concernees": mission.phases_concernees,
            "icone": mission.icone,
            "couleur": mission.couleur,
            "est_obligatoire": mission.est_obligatoire,
            "profil_horaire_defaut_id": str(mission.profil_horaire_defaut_id) if mission.profil_horaire_defaut_id else "",
            "profil_horaire_defaut_libelle": mission.profil_horaire_defaut.libelle if mission.profil_horaire_defaut_id else "",
            "profil_horaire_defaut_taux": str(mission.profil_horaire_defaut.taux_horaire_ht) if mission.profil_horaire_defaut_id else "",
            "duree_etude_heures": str(mission.duree_etude_heures),
            "mode_chiffrage_defaut": mission.mode_chiffrage_defaut,
            "duree_etude_jours": str(mission.duree_etude_jours),
            "complexite": mission.complexite,
            "coefficient_complexite": str(mission.coefficient_complexite),
            "phase_mission": mission.phase_mission,
            "nature_livrable": mission.nature_livrable,
            "inclusion_recommandee_devis": mission.inclusion_recommandee_devis,
            "livrables": livrables,
        })
    return missions


def construire_suggestions_prestations(missions: list[dict[str, Any]], profil_horaire=None) -> list[dict[str, Any]]:
    suggestions: list[dict[str, Any]] = []
    for ordre, mission in enumerate(missions):
        livrables = mission.get("livrables", [])
        libelles_livrables = [livrable["libelle"] for livrable in livrables]
        designation = mission["libelle"]
        if libelles_livrables:
            designation = f"{designation} — {', '.join(libelles_livrables)}"

        description = (mission.get("description") or "").strip()
        if libelles_livrables:
            suffixe = f"Livrables: {', '.join(libelles_livrables)}."
            description = f"{description}\n\n{suffixe}".strip()

        suggestion = {
            "ordre": ordre,
            "mission_code": mission["code"],
            "intitule": designation,
            "description": description,
            "phase_code": (mission.get("phases_concernees") or [""])[0] or "",
            "livrables_codes": [livrable["code"] for livrable in livrables],
            "livrables_labels": libelles_livrables,
            "type_ligne": "forfait",
            "mode_chiffrage": mission.get("mode_chiffrage_defaut") or "forfait_mission",
            "quantite": "1",
            "unite": "forfait",
            "nb_heures_suggerees": "8.00",
            "nb_jours_suggerees": mission.get("duree_etude_jours") or "0.00",
            "profil_horaire_id": "",
            "profil_horaire_libelle": "",
            "taux_horaire_suggere": "0.00",
            "forfait_jour_suggere": "0.00",
        }
        if profil_horaire is not None:
            suggestion.update({
                "type_ligne": "horaire",
                "mode_chiffrage": mission.get("mode_chiffrage_defaut") or "taux_profil",
                "unite": "h",
                "profil_horaire_id": str(profil_horaire.id),
                "profil_horaire_libelle": profil_horaire.libelle,
                "taux_horaire_suggere": str(profil_horaire.taux_horaire_ht),
                "forfait_jour_suggere": str(profil_horaire.forfait_jour_ht_calcule),
            })
        elif mission.get("profil_horaire_defaut_id"):
            suggestion.update({
                "type_ligne": "horaire",
                "mode_chiffrage": mission.get("mode_chiffrage_defaut") or "taux_profil",
                "unite": "h",
                "profil_horaire_id": mission.get("profil_horaire_defaut_id") or "",
                "profil_horaire_libelle": mission.get("profil_horaire_defaut_libelle") or "",
                "taux_horaire_suggere": mission.get("profil_horaire_defaut_taux") or "0.00",
            })
        if mission.get("duree_etude_heures"):
            suggestion["nb_heures_suggerees"] = mission["duree_etude_heures"]
        suggestions.append(suggestion)
    return suggestions


def construire_contexte_projet_saisi(
    *,
    famille_client: str,
    sous_type_client: str,
    contexte_contractuel: str,
    nature_ouvrage: str,
    nature_marche: str,
    role_lbh: str,
    missions_selectionnees: list[dict[str, Any]],
) -> dict[str, Any]:
    mission_principale = missions_selectionnees[0]["missionCode"] if missions_selectionnees else ""
    return {
        "famille_client": famille_client,
        "sous_type_client": sous_type_client,
        "contexte_contractuel": contexte_contractuel,
        "mission_principale": mission_principale,
        "missions_associees": [mission["missionCode"] for mission in missions_selectionnees],
        "livrables_selectionnes": [
            code
            for mission in missions_selectionnees
            for code in mission.get("livrablesCodes", [])
        ],
        "phase_intervention": "",
        "nature_ouvrage": nature_ouvrage,
        "nature_marche": nature_marche,
        "role_lbh": role_lbh,
        "methode_estimation": "",
        "donnees_entree": {},
    }


def generer_jeton_validation() -> str:
    return uuid.uuid4().hex


def _echapper_pdf_texte(valeur: str) -> str:
    return (
        valeur.replace("€", "EUR")
        .replace("\\", "\\\\")
        .replace("(", "\\(")
        .replace(")", "\\)")
        .replace("\r", " ")
        .replace("\n", "\\n")
    )


def _pdf_texte_simple(lignes: list[str], titre: str) -> bytes:
    flux = ["BT", "/F1 16 Tf", "40 800 Td", f"({_echapper_pdf_texte(titre)}) Tj", "/F1 10 Tf"]
    y = 780
    for ligne in lignes:
        if y <= 40:
            break
        y -= 14
        flux.append(f"1 0 0 1 40 {y} Tm ({_echapper_pdf_texte(ligne)}) Tj")
    contenu = "\n".join(flux) + "\nET"
    objet_flux = f"<< /Length {len(contenu.encode('latin-1', errors='ignore'))} >>\nstream\n{contenu}\nendstream"

    objets = [
        "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
        "2 0 obj << /Type /Pages /Count 1 /Kids [3 0 R] >> endobj",
        "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj",
        f"4 0 obj\n{objet_flux}\nendobj",
        "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    ]

    contenu_pdf = ["%PDF-1.4"]
    offsets = [0]
    total = len("%PDF-1.4\n".encode("latin-1"))
    for objet in objets:
        offsets.append(total)
        bloc = f"{objet}\n"
        contenu_pdf.append(bloc)
        total += len(bloc.encode("latin-1", errors="ignore"))

    xref_offset = total
    contenu_pdf.append(f"xref\n0 {len(offsets)}\n")
    contenu_pdf.append("0000000000 65535 f \n")
    for offset in offsets[1:]:
        contenu_pdf.append(f"{offset:010d} 00000 n \n")
    contenu_pdf.append(
        f"trailer << /Size {len(offsets)} /Root 1 0 R >>\nstartxref\n{xref_offset}\n%%EOF"
    )
    return "".join(contenu_pdf).encode("latin-1", errors="ignore")


def generer_pdf_devis(devis, *, validation_url: str = "", base_url: str = "") -> bytes:
    configuration = ConfigurationSite.obtenir()
    logo_url = ""
    if configuration.logo:
        if base_url and configuration.logo.url.startswith("/"):
            logo_url = f"{base_url.rstrip('/')}{configuration.logo.url}"
        else:
            logo_url = configuration.logo.url

    lignes = list(devis.lignes.order_by("ordre"))
    missions = devis.missions_selectionnees or []
    html = render_to_string(
        "societe/devis_honoraires_pdf.html",
        {
            "configuration": configuration,
            "devis": devis,
            "lignes": lignes,
            "missions": missions,
            "logo_url": logo_url,
            "validation_url": validation_url,
        },
    )

    try:
        from weasyprint import HTML
    except Exception:
        lignes_texte = [
            f"Référence : {devis.reference}",
            f"Client : {devis.client_nom}",
            f"Intitulé : {devis.intitule}",
            f"Montant HT : {devis.montant_ht} €",
            f"Montant TTC : {devis.montant_ttc} €",
            "",
        ]
        for ligne in lignes:
            montant = getattr(ligne, "montant_ht", Decimal("0"))
            lignes_texte.append(f"- {ligne.intitule} | {montant} € HT")
        if validation_url:
            lignes_texte.extend(["", f"Validation : {validation_url}"])
        return _pdf_texte_simple(lignes_texte, f"Devis {devis.reference}")

    return HTML(string=html, base_url=base_url or None).write_pdf()


def rendu_validation_html(titre: str, message: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>{escape(titre)}</title>
  <style>
    body {{
      margin: 0;
      font-family: Arial, sans-serif;
      background: #f8fafc;
      color: #0f172a;
    }}
    .page {{
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }}
    .carte {{
      width: 100%;
      max-width: 560px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 20px;
      padding: 32px;
      box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
    }}
    h1 {{
      margin: 0 0 12px 0;
      font-size: 28px;
    }}
    p {{
      margin: 0;
      line-height: 1.6;
      color: #475569;
    }}
  </style>
</head>
<body>
  <div class="page">
    <div class="carte">
      <h1>{escape(titre)}</h1>
      <p>{escape(message)}</p>
    </div>
  </div>
</body>
</html>"""
