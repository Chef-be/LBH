"""Services métier pour le planning de chantier."""

from __future__ import annotations

from collections import defaultdict, deque
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from decimal import Decimal, ROUND_UP
from io import BytesIO
from zipfile import ZIP_DEFLATED, ZipFile

from django.template.loader import render_to_string
from openpyxl import Workbook

from .models import (
    AffectationEquipeTache,
    DependanceTachePlanning,
    PlanningChantier,
    TachePlanning,
)


ZERO = Decimal("0")


def _to_decimal(value) -> Decimal:
    if value is None or value == "":
        return ZERO
    return Decimal(str(value))


def _ceil_2(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_UP)


def _normaliser_date(valeur) -> date:
    if isinstance(valeur, date):
        return valeur
    if isinstance(valeur, datetime):
        return valeur.date()
    return date.fromisoformat(str(valeur))


def _jours_ouvres(planning: PlanningChantier) -> set[int]:
    jours = planning.jours_ouvres or [0, 1, 2, 3, 4]
    resultat = {int(jour) for jour in jours if str(jour).isdigit()}
    return resultat or {0, 1, 2, 3, 4}


def _jours_feries(planning: PlanningChantier) -> set[date]:
    resultat: set[date] = set()
    for valeur in planning.jours_feries or []:
        try:
            resultat.add(_normaliser_date(valeur))
        except Exception:
            continue
    return resultat


def _est_jour_ouvre(jour: date, planning: PlanningChantier) -> bool:
    return jour.weekday() in _jours_ouvres(planning) and jour not in _jours_feries(planning)


def _ajouter_jours_ouvres(depart: date, nombre_jours: int, planning: PlanningChantier) -> date:
    if nombre_jours <= 0:
        courant = depart
        while not _est_jour_ouvre(courant, planning):
            courant += timedelta(days=1)
        return courant

    courant = depart
    while not _est_jour_ouvre(courant, planning):
        courant += timedelta(days=1)

    restants = nombre_jours
    while restants > 0:
        courant += timedelta(days=1)
        if _est_jour_ouvre(courant, planning):
            restants -= 1
    return courant


def _date_depuis_offset_ouvre(planning: PlanningChantier, offset_jours: Decimal) -> date:
    return _ajouter_jours_ouvres(
        _normaliser_date(planning.date_debut_reference),
        int(offset_jours.to_integral_value(rounding=ROUND_UP)),
        planning,
    )


def _echapper_pdf_texte(valeur: str) -> str:
    """Échappe le texte pour un contenu PDF simple."""
    return (
        str(valeur)
        .replace("\\", "\\\\")
        .replace("(", "\\(")
        .replace(")", "\\)")
    )


def _generer_pdf_texte(lignes: list[str], titre: str) -> bytes:
    """Génère un PDF texte minimal, sans dépendance native externe."""
    largeur, hauteur = 595, 842
    marge_haut = 800
    interligne = 16
    lignes_par_page = 46
    pages: list[list[str]] = []
    tampon: list[str] = []
    for ligne in lignes:
        if len(tampon) >= lignes_par_page:
            pages.append(tampon)
            tampon = []
        tampon.append(ligne[:160])
    if tampon or not pages:
        pages.append(tampon or [""])

    objets: list[bytes] = []
    objets.append(b"<< /Type /Catalog /Pages 2 0 R >>")

    kids = " ".join(f"{index} 0 R" for index in range(3, 3 + len(pages) * 2, 2))
    objets.append(f"<< /Type /Pages /Kids [{kids}] /Count {len(pages)} >>".encode("latin-1"))

    font_id = 3 + len(pages) * 2
    for index, lignes_page in enumerate(pages):
        page_id = 3 + index * 2
        content_id = page_id + 1
        objets.append(
            (
                f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {largeur} {hauteur}] "
                f"/Resources << /Font << /F1 {font_id} 0 R >> >> /Contents {content_id} 0 R >>"
            ).encode("latin-1")
        )

        commandes = ["BT", "/F1 16 Tf", "50 810 Td", f"({_echapper_pdf_texte(titre)}) Tj", "/F1 10 Tf"]
        position_y = marge_haut - interligne * 2
        for ligne in lignes_page:
            commandes.append(f"1 0 0 1 50 {position_y} Tm")
            commandes.append(f"({_echapper_pdf_texte(ligne)}) Tj")
            position_y -= interligne
        commandes.append("ET")
        flux = "\n".join(commandes).encode("latin-1", errors="replace")
        objets.append(f"<< /Length {len(flux)} >>\nstream\n".encode("latin-1") + flux + b"\nendstream")

    objets.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>")

    buffer = BytesIO()
    buffer.write(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets = [0]
    for numero, objet in enumerate(objets, start=1):
        offsets.append(buffer.tell())
        buffer.write(f"{numero} 0 obj\n".encode("latin-1"))
        buffer.write(objet)
        buffer.write(b"\nendobj\n")
    xref_offset = buffer.tell()
    buffer.write(f"xref\n0 {len(objets) + 1}\n".encode("latin-1"))
    buffer.write(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        buffer.write(f"{offset:010d} 00000 n \n".encode("latin-1"))
    buffer.write(
        (
            f"trailer\n<< /Size {len(objets) + 1} /Root 1 0 R >>\n"
            f"startxref\n{xref_offset}\n%%EOF"
        ).encode("latin-1")
    )
    return buffer.getvalue()


def _effectif_equivalent(tache: TachePlanning) -> Decimal:
    affectations = list(tache.affectations_equipe.all())
    if affectations:
        total = ZERO
        for affectation in affectations:
            total += Decimal(affectation.effectif) * _to_decimal(affectation.rendement_relatif or 1)
        return total if total > ZERO else Decimal(max(tache.effectif_alloue, 1))
    return Decimal(max(tache.effectif_alloue, 1))


def _profils_ressource(tache: TachePlanning) -> list[str]:
    return [str(affectation.profil_id) for affectation in tache.affectations_equipe.all() if affectation.profil_id]


def recalculer_tache(tache: TachePlanning) -> None:
    heures_totales = _to_decimal(tache.quantite) * _to_decimal(tache.temps_unitaire_heures)
    tache.heures_totales = heures_totales
    if tache.mode_calcul == "manuel":
        return

    heures_par_jour = _to_decimal(tache.planning.heures_par_jour or 7)
    rendement = _to_decimal(tache.planning.coefficient_rendement_global or 1)
    effectif = _effectif_equivalent(tache)
    capacite_jour = heures_par_jour * effectif * rendement
    if capacite_jour <= ZERO:
        capacite_jour = Decimal("7.00")

    duree = heures_totales / capacite_jour if heures_totales > ZERO else Decimal("1.00")
    tache.duree_jours = max(_ceil_2(duree), Decimal("1.00"))
    tache.effectif_alloue = max(int(effectif), 1)
    tache.metadata_calcul = {
        **(tache.metadata_calcul or {}),
        "heures_par_jour": str(heures_par_jour),
        "effectif_equivalent": str(effectif),
        "capacite_journaliere_heures": str(capacite_jour),
        "heures_totales": str(heures_totales),
    }


def regenerer_taches_planning_depuis_sources(planning: PlanningChantier) -> int:
    """Recrée les tâches depuis l'étude liée au planning."""
    planning.taches.all().delete()
    taches: list[TachePlanning] = []

    if planning.source_donnees == "etude_economique" and planning.etude_economique_id:
        lignes = planning.etude_economique.lignes.select_related("ref_bibliotheque").order_by("numero_ordre")
        for ligne in lignes:
            temps = ligne.temps_main_oeuvre or getattr(ligne.ref_bibliotheque, "temps_main_oeuvre", ZERO)
            taches.append(
                TachePlanning(
                    planning=planning,
                    numero_ordre=ligne.numero_ordre,
                    code=ligne.code,
                    designation=ligne.designation[:500],
                    unite=ligne.unite,
                    quantite=ligne.quantite_prevue,
                    temps_unitaire_heures=temps,
                    ref_ligne_economique=ligne,
                    effectif_alloue=1,
                )
            )
    elif planning.source_donnees == "etude_prix" and planning.etude_prix_id:
        lignes = planning.etude_prix.lignes.order_by("ordre")
        for ligne in lignes:
            temps = ligne.quantite if ligne.type_ressource == "mo" else ZERO
            taches.append(
                TachePlanning(
                    planning=planning,
                    numero_ordre=ligne.ordre,
                    code=ligne.code,
                    designation=ligne.designation[:500],
                    unite=ligne.unite,
                    quantite=Decimal("1.00"),
                    temps_unitaire_heures=temps,
                    ref_ligne_prix=ligne,
                    effectif_alloue=1,
                )
            )

    TachePlanning.objects.bulk_create(taches)
    taches_creees = list(planning.taches.all().order_by("numero_ordre", "designation"))
    for index, tache in enumerate(taches_creees):
        recalculer_tache(tache)
        tache.save()
        if index > 0:
            DependanceTachePlanning.objects.get_or_create(
                tache_amont=taches_creees[index - 1],
                tache_aval=tache,
                type_dependance="fd",
            )

    recalculer_planning(planning)
    return len(taches_creees)


@dataclass
class _NoeudPlanning:
    tache: TachePlanning
    duree: Decimal
    debut_tot: Decimal = ZERO
    fin_tot: Decimal = ZERO
    debut_tardif: Decimal = ZERO
    fin_tardive: Decimal = ZERO
    marge: Decimal = ZERO


def recalculer_planning(planning: PlanningChantier) -> dict[str, object]:
    taches = list(
        planning.taches.prefetch_related("dependances_entrantes__tache_amont", "affectations_equipe").all().order_by("numero_ordre", "designation")
    )
    for tache in taches:
        recalculer_tache(tache)

    noeuds = {str(tache.id): _NoeudPlanning(tache=tache, duree=_to_decimal(tache.duree_jours)) for tache in taches}
    successeurs: dict[str, list[tuple[str, Decimal, str]]] = defaultdict(list)
    indegres: dict[str, int] = {str(tache.id): 0 for tache in taches}

    for tache in taches:
        for dep in tache.dependances_entrantes.all():
            amont = str(dep.tache_amont_id)
            aval = str(dep.tache_aval_id)
            decalage = _to_decimal(dep.decalage_jours)
            successeurs[amont].append((aval, decalage, dep.type_dependance))
            indegres[aval] = indegres.get(aval, 0) + 1

    file = deque(sorted([ident for ident, degre in indegres.items() if degre == 0], key=lambda ident: noeuds[ident].tache.numero_ordre))
    ordre: list[str] = []
    while file:
        ident = file.popleft()
        ordre.append(ident)
        noeud = noeuds[ident]
        noeud.debut_tot = max(noeud.debut_tot, _to_decimal(noeud.tache.decalage_jours))
        noeud.fin_tot = noeud.debut_tot + noeud.duree
        for succ, decalage, type_dependance in successeurs.get(ident, []):
            successeur = noeuds[succ]
            if type_dependance == "dd":
                successeur.debut_tot = max(
                    successeur.debut_tot,
                    noeud.debut_tot + decalage,
                    _to_decimal(successeur.tache.decalage_jours),
                )
            else:
                successeur.debut_tot = max(
                    successeur.debut_tot,
                    noeud.fin_tot + decalage,
                    _to_decimal(successeur.tache.decalage_jours),
                )
            indegres[succ] -= 1
            if indegres[succ] == 0:
                file.append(succ)

    if len(ordre) != len(taches):
        raise ValueError("Le planning contient une boucle de dépendances. Corrigez les liaisons entre tâches.")

    if planning.lisser_ressources_partagees:
        disponibilites_profils: dict[str, Decimal] = {}
        conflits_ressources = 0
        for ident in ordre:
            noeud = noeuds[ident]
            profils = _profils_ressource(noeud.tache)
            if profils:
                debut_lisse = max([noeud.debut_tot, *[disponibilites_profils.get(profil, ZERO) for profil in profils]])
                if debut_lisse > noeud.debut_tot:
                    conflits_ressources += 1
                    noeud.debut_tot = debut_lisse
                    noeud.fin_tot = noeud.debut_tot + noeud.duree
                for profil in profils:
                    disponibilites_profils[profil] = noeud.fin_tot
        for ident in ordre:
            noeuds[ident].fin_tot = noeuds[ident].debut_tot + noeuds[ident].duree
    else:
        conflits_ressources = 0

    duree_totale = max((noeuds[ident].debut_tot + noeuds[ident].duree for ident in ordre), default=ZERO)

    for ident in reversed(ordre):
        noeud = noeuds[ident]
        if not successeurs.get(ident):
            noeud.fin_tardive = duree_totale
        else:
            valeurs = []
            for succ, decalage, _type_dependance in successeurs.get(ident, []):
                noeud_succ = noeuds[succ]
                valeurs.append(noeud_succ.debut_tardif - decalage)
            noeud.fin_tardive = min(valeurs) if valeurs else duree_totale
        noeud.debut_tardif = noeud.fin_tardive - noeud.duree
        noeud.marge = max(noeud.debut_tardif - noeud.debut_tot, ZERO)

    chemin_critique: list[str] = []
    for ident in ordre:
        noeud = noeuds[ident]
        tache = noeud.tache
        tache.marge_libre_jours = _ceil_2(noeud.marge)
        tache.est_critique = noeud.marge <= Decimal("0.01")
        if tache.est_critique:
            chemin_critique.append(str(tache.id))

        debut_offset = noeud.debut_tot
        duree_jours = max(int(noeud.duree.to_integral_value(rounding=ROUND_UP)), 1)
        date_debut = _date_depuis_offset_ouvre(planning, debut_offset)
        date_fin = _ajouter_jours_ouvres(date_debut, max(duree_jours - 1, 0), planning)
        tache.date_debut_calculee = date_debut
        tache.date_fin_calculee = date_fin
        tache.heures_totales = _to_decimal(tache.quantite) * _to_decimal(tache.temps_unitaire_heures)
        tache.save(update_fields=[
            "heures_totales",
            "effectif_alloue",
            "duree_jours",
            "marge_libre_jours",
            "est_critique",
            "date_debut_calculee",
            "date_fin_calculee",
            "metadata_calcul",
        ])

    planning.chemin_critique = chemin_critique
    planning.synthese_calcul = {
        "duree_totale_jours": str(_ceil_2(duree_totale)),
        "nb_taches": len(taches),
        "nb_taches_critiques": len(chemin_critique),
        "nb_conflits_ressources": conflits_ressources,
        "jours_ouvres": sorted(_jours_ouvres(planning)),
        "jours_feries": sorted(jour.isoformat() for jour in _jours_feries(planning)),
    }
    planning.save(update_fields=["chemin_critique", "synthese_calcul"])
    return planning.synthese_calcul


def mettre_a_jour_affectations_tache(tache: TachePlanning, affectations: list[dict[str, object]]) -> None:
    tache.affectations_equipe.all().delete()
    nouvelles = [
        AffectationEquipeTache(
            tache=tache,
            profil_id=element["profil"],
            effectif=int(element.get("effectif", 1) or 1),
            rendement_relatif=_to_decimal(element.get("rendement_relatif", "1.0000")),
            est_chef_equipe=bool(element.get("est_chef_equipe", False)),
        )
        for element in affectations
        if element.get("profil")
    ]
    if nouvelles:
        AffectationEquipeTache.objects.bulk_create(nouvelles)
    recalculer_tache(tache)
    tache.save()
    recalculer_planning(tache.planning)


def exporter_planning_xlsx(planning: PlanningChantier) -> bytes:
    classeur = Workbook()
    feuille = classeur.active
    feuille.title = "Planning"
    feuille.append([
        "Ordre", "Code", "Désignation", "Début", "Fin", "Durée (j)",
        "Quantité", "Temps unitaire (h)", "Heures totales", "Effectif",
        "Critique", "Marge (j)", "Dépendances", "Équipe",
    ])

    for tache in planning.taches.prefetch_related("dependances_entrantes__tache_amont", "affectations_equipe__profil").order_by("numero_ordre", "designation"):
        dependances = ", ".join(
            f"{dep.tache_amont.code or dep.tache_amont.numero_ordre} {dep.get_type_dependance_display()} ({dep.decalage_jours} j)"
            for dep in tache.dependances_entrantes.all()
        )
        equipe = ", ".join(
            f"{aff.profil.libelle} x{aff.effectif}"
            for aff in tache.affectations_equipe.all()
        )
        feuille.append([
            tache.numero_ordre,
            tache.code,
            tache.designation,
            tache.date_debut_calculee.isoformat() if tache.date_debut_calculee else "",
            tache.date_fin_calculee.isoformat() if tache.date_fin_calculee else "",
            float(tache.duree_jours),
            float(tache.quantite),
            float(tache.temps_unitaire_heures),
            float(tache.heures_totales),
            tache.effectif_alloue,
            "Oui" if tache.est_critique else "Non",
            float(tache.marge_libre_jours),
            dependances,
            equipe,
        ])

    synthese = classeur.create_sheet("Synthèse")
    synthese.append(["Champ", "Valeur"])
    synthese.append(["Planning", planning.intitule])
    synthese.append(["Projet", planning.suivi.projet.reference])
    synthese.append(["Source", planning.get_source_donnees_display()])
    synthese.append(["Début de référence", planning.date_debut_reference.isoformat()])
    synthese.append(["Heures par jour", float(planning.heures_par_jour)])
    synthese.append(["Coefficient de rendement", float(planning.coefficient_rendement_global)])
    synthese.append(["Jours ouvrés", ", ".join(str(j) for j in sorted(_jours_ouvres(planning)))])
    synthese.append(["Jours neutralisés", ", ".join(j.isoformat() for j in sorted(_jours_feries(planning)))])
    for cle, valeur in (planning.synthese_calcul or {}).items():
        if isinstance(valeur, (list, dict)):
            valeur = str(valeur)
        synthese.append([cle, valeur])

    contenu = BytesIO()
    classeur.save(contenu)
    contenu.seek(0)
    return contenu.getvalue()


def exporter_planning_pdf(planning: PlanningChantier) -> bytes:
    taches = list(planning.taches.prefetch_related("dependances_entrantes__tache_amont", "affectations_equipe__profil").order_by("numero_ordre", "designation"))
    duree_totale = float(planning.synthese_calcul.get("duree_totale_jours", "0") or 0)

    lignes = []
    for tache in taches:
        offset = 0
        if tache.date_debut_calculee:
            offset = max((tache.date_debut_calculee - _normaliser_date(planning.date_debut_reference)).days, 0)
        lignes.append({
            "tache": tache,
            "left": 0 if duree_totale <= 0 else min((offset / max(duree_totale, 1)) * 100, 100),
            "width": max((float(tache.duree_jours or 1) / max(duree_totale, 1)) * 100, 3),
            "equipe": ", ".join(f"{aff.profil.libelle} x{aff.effectif}" for aff in tache.affectations_equipe.all()) or "Équipe non détaillée",
            "dependances": ", ".join(
                f"{dep.tache_amont.code or dep.tache_amont.numero_ordre} {dep.get_type_dependance_display()} ({dep.decalage_jours} j)"
                for dep in tache.dependances_entrantes.all()
            ) or "Aucune",
        })

    html = render_to_string("execution/planning_chantier_pdf.html", {
        "planning": planning,
        "lignes": lignes,
        "duree_totale": planning.synthese_calcul.get("duree_totale_jours", "0"),
    })
    try:
        from weasyprint import HTML
    except Exception:
        texte = [
            f"Projet : {planning.suivi.projet.reference}",
            f"Source : {planning.get_source_donnees_display()}",
            f"Début de référence : {planning.date_debut_reference.isoformat()}",
            f"Durée totale : {planning.synthese_calcul.get('duree_totale_jours', '0')} j",
            "",
        ]
        for ligne in lignes:
            tache = ligne["tache"]
            texte.append(
                " | ".join([
                    f"{tache.numero_ordre}. {tache.designation}",
                    f"Début {tache.date_debut_calculee.isoformat() if tache.date_debut_calculee else '-'}",
                    f"Fin {tache.date_fin_calculee.isoformat() if tache.date_fin_calculee else '-'}",
                    f"Durée {tache.duree_jours} j",
                    f"Équipe {ligne['equipe']}",
                    f"Critique {'Oui' if tache.est_critique else 'Non'}",
                ])
            )
            if ligne["dependances"] != "Aucune":
                texte.append(f"  Dépendances : {ligne['dependances']}")
        return _generer_pdf_texte(texte, f"Planning chantier - {planning.intitule}")

    return HTML(string=html).write_pdf()


def exporter_planning_archives(planning: PlanningChantier) -> bytes:
    xlsx = exporter_planning_xlsx(planning)
    pdf = exporter_planning_pdf(planning)
    tampon = BytesIO()
    with ZipFile(tampon, "w", compression=ZIP_DEFLATED) as archive:
        base = (planning.intitule or "planning-chantier").replace("/", "-")
        archive.writestr(f"{base}.xlsx", xlsx)
        archive.writestr(f"{base}.pdf", pdf)
    tampon.seek(0)
    return tampon.getvalue()
