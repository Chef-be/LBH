"""
Services de capacité RH et d'assignation automatique.

Les règles de temps de travail restent paramétrables : le service calcule avec
les profils RH, calendriers et validations enregistrés, sans figer une
convention collective dans le code.
"""

from __future__ import annotations

from datetime import date, datetime, time, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Any

from django.db.models import Sum, Q
from django.utils import timezone

from applications.comptes.models import Utilisateur
from applications.projets.models import AffectationProjet
from applications.societe.models import (
    CalendrierTravailSociete,
    CompteurTempsSalarie,
    DemandeAbsence,
    EvenementPointage,
    PointageJournalier,
    ProfilRHSalarie,
    SoldeAbsenceSalarie,
    TempsPasse,
)


JOURS_SEMAINE = {
    0: "lundi",
    1: "mardi",
    2: "mercredi",
    3: "jeudi",
    4: "vendredi",
    5: "samedi",
    6: "dimanche",
}


def _d(valeur: Any, defaut: str = "0") -> Decimal:
    if valeur is None or valeur == "":
        return Decimal(defaut)
    return Decimal(str(valeur))


def _q(valeur: Any, precision: str = "0.01") -> Decimal:
    return _d(valeur).quantize(Decimal(precision), rounding=ROUND_HALF_UP)


def _date(valeur: Any, defaut: date | None = None) -> date:
    if isinstance(valeur, date):
        return valeur
    if isinstance(valeur, datetime):
        return valeur.date()
    if valeur:
        return datetime.strptime(str(valeur), "%Y-%m-%d").date()
    return defaut or timezone.localdate()


def _periode(date_debut: Any = None, date_fin: Any = None) -> tuple[date, date]:
    debut = _date(date_debut, timezone.localdate())
    fin = _date(date_fin, debut + timedelta(days=30))
    if fin < debut:
        debut, fin = fin, debut
    return debut, fin


def _jours_entre(debut: date, fin: date):
    courant = debut
    while courant <= fin:
        yield courant
        courant += timedelta(days=1)


def _profil_rh(utilisateur: Utilisateur) -> ProfilRHSalarie:
    profil = getattr(utilisateur, "profil_rh_societe", None)
    if profil:
        return profil
    profil_horaire = getattr(getattr(utilisateur, "profil_horaire_societe", None), "profil_horaire", None)
    return ProfilRHSalarie.objects.create(
        utilisateur=utilisateur,
        organisation=getattr(utilisateur, "organisation", None),
        profil_horaire_societe=profil_horaire,
        date_entree=timezone.localdate(),
    )


def _calendrier(organisation, annee: int) -> CalendrierTravailSociete | None:
    qs = CalendrierTravailSociete.objects.filter(annee=annee, actif=True)
    if organisation:
        return qs.filter(Q(organisation=organisation) | Q(organisation__isnull=True)).order_by("-organisation_id").first()
    return qs.filter(organisation__isnull=True).first()


def _jours_travailles(profil: ProfilRHSalarie) -> set[str]:
    jours = profil.jours_travailles_semaine or []
    if isinstance(jours, dict):
        return {jour for jour, actif in jours.items() if actif}
    return set(jours or ["lundi", "mardi", "mercredi", "jeudi", "vendredi"])


def _est_jour_travaille(jour: date, profil: ProfilRHSalarie, calendrier: CalendrierTravailSociete | None) -> bool:
    libelle_jour = JOURS_SEMAINE[jour.weekday()]
    jours_travailles = _jours_travailles(profil)
    if calendrier and calendrier.semaine_type:
        semaine = calendrier.semaine_type
        if isinstance(semaine, dict) and libelle_jour in semaine:
            travaille_calendrier = bool(semaine.get(libelle_jour))
        else:
            travaille_calendrier = libelle_jour in jours_travailles
    else:
        travaille_calendrier = libelle_jour in jours_travailles

    iso = jour.isoformat()
    jours_feries = set((calendrier.jours_feries or []) if calendrier else [])
    exceptions = set((calendrier.jours_non_travailles_exceptionnels or []) if calendrier else [])
    return travaille_calendrier and iso not in jours_feries and iso not in exceptions


def heures_theoriques_jour(profil: ProfilRHSalarie) -> Decimal:
    jours = max(len(_jours_travailles(profil)), 1)
    heures = _d(profil.heures_hebdomadaires_contractuelles, "35") / Decimal(jours)
    return _q(heures * _d(profil.taux_activite, "1"))


def calculer_jours_heures_absence(demande: DemandeAbsence) -> dict[str, Decimal]:
    profil = _profil_rh(demande.utilisateur)
    debut, fin = _periode(demande.date_debut, demande.date_fin)
    heures_par_jour = heures_theoriques_jour(profil)
    jours = Decimal("0.00")
    calendrier = _calendrier(getattr(demande.utilisateur, "organisation", None), debut.year)
    for jour in _jours_entre(debut, fin):
        if not _est_jour_travaille(jour, profil, calendrier):
            continue
        coefficient = Decimal("1.00")
        if debut == fin and demande.demi_journee_debut:
            coefficient = Decimal("0.50")
        elif jour == debut and demande.demi_journee_debut:
            coefficient = Decimal("0.50")
        elif jour == fin and demande.demi_journee_fin:
            coefficient = Decimal("0.50")
        jours += coefficient
    return {
        "jours": _q(jours),
        "heures": _q(jours * heures_par_jour),
    }


def recalculer_solde_absence(utilisateur: Utilisateur, annee: int, type_absence: str) -> SoldeAbsenceSalarie:
    solde, _ = SoldeAbsenceSalarie.objects.get_or_create(
        utilisateur=utilisateur,
        annee=annee,
        type_absence=type_absence if type_absence in {"conge_paye", "rtt", "recuperation"} else "autre",
        defaults={"acquis": Decimal("0.00")},
    )
    qs = DemandeAbsence.objects.filter(utilisateur=utilisateur, date_debut__year=annee, type_absence=type_absence)
    solde.pris = _q(qs.filter(statut="valide", impacte_solde=True).aggregate(total=Sum("nombre_jours_ouvres_calcule"))["total"] or 0)
    solde.en_attente_validation = _q(qs.filter(statut="soumis", impacte_solde=True).aggregate(total=Sum("nombre_jours_ouvres_calcule"))["total"] or 0)
    solde.recalculer_solde()
    solde.save()
    return solde


def enregistrer_evenement_pointage(pointage: PointageJournalier, type_evenement: str, utilisateur: Utilisateur, request=None, commentaire: str = ""):
    adresse_ip = None
    user_agent = ""
    if request:
        adresse_ip = request.META.get("HTTP_X_FORWARDED_FOR", request.META.get("REMOTE_ADDR", "")).split(",")[0] or None
        user_agent = request.META.get("HTTP_USER_AGENT", "")[:1000]
    return EvenementPointage.objects.create(
        utilisateur=utilisateur,
        pointage=pointage,
        type_evenement=type_evenement,
        source=pointage.source,
        adresse_ip=adresse_ip,
        user_agent=user_agent,
        commentaire=commentaire,
    )


def pointer_arrivee(utilisateur: Utilisateur, request=None) -> PointageJournalier:
    aujourd_hui = timezone.localdate()
    pointage, _ = PointageJournalier.objects.get_or_create(utilisateur=utilisateur, date=aujourd_hui)
    if pointage.heure_arrivee and not pointage.heure_depart:
        raise ValueError("Une arrivée est déjà pointée sans départ.")
    if pointage.statut == "valide":
        raise ValueError("Une journée validée nécessite une correction.")
    pointage.heure_arrivee = timezone.localtime().time().replace(microsecond=0)
    pointage.statut = "brouillon"
    pointage.source = "manuel"
    pointage.save()
    enregistrer_evenement_pointage(pointage, "arrivee", utilisateur, request)
    return pointage


def pointer_depart(utilisateur: Utilisateur, request=None) -> PointageJournalier:
    pointage = PointageJournalier.objects.filter(utilisateur=utilisateur, date=timezone.localdate()).first()
    if not pointage or not pointage.heure_arrivee:
        raise ValueError("Impossible de pointer un départ avant une arrivée.")
    if pointage.statut == "valide":
        raise ValueError("Une journée validée nécessite une correction.")
    pointage.heure_depart = timezone.localtime().time().replace(microsecond=0)
    pointage.statut = "soumis"
    pointage.save()
    enregistrer_evenement_pointage(pointage, "depart", utilisateur, request)
    return pointage


def enregistrer_pause(utilisateur: Utilisateur, minutes: int, request=None) -> PointageJournalier:
    pointage = PointageJournalier.objects.filter(utilisateur=utilisateur, date=timezone.localdate()).first()
    if not pointage or not pointage.heure_arrivee:
        raise ValueError("Aucun pointage ouvert pour enregistrer une pause.")
    pointage.pause_minutes = max(0, int(minutes or 0))
    pointage.save(update_fields=["pause_minutes", "date_modification"])
    enregistrer_evenement_pointage(pointage, "debut_pause", utilisateur, request, commentaire=f"Pause cumulée : {pointage.pause_minutes} min")
    return pointage


def calculer_capacite_salarie(utilisateur: Utilisateur, date_debut=None, date_fin=None) -> dict[str, Any]:
    debut, fin = _periode(date_debut, date_fin)
    profil = _profil_rh(utilisateur)
    calendrier = _calendrier(getattr(utilisateur, "organisation", None), debut.year)
    heures_jour = heures_theoriques_jour(profil)

    jours_travailles = [jour for jour in _jours_entre(debut, fin) if _est_jour_travaille(jour, profil, calendrier)]
    heures_theoriques = _q(Decimal(len(jours_travailles)) * heures_jour)

    absences = DemandeAbsence.objects.filter(
        utilisateur=utilisateur,
        impacte_capacite=True,
        date_debut__lte=fin,
        date_fin__gte=debut,
    )
    heures_absences_validees = _q(absences.filter(statut="valide").exclude(type_absence="formation").aggregate(total=Sum("nombre_heures_calcule"))["total"] or 0)
    heures_absences_attente = _q(absences.filter(statut="soumis").exclude(type_absence="formation").aggregate(total=Sum("nombre_heures_calcule"))["total"] or 0)
    heures_formation = _q(absences.filter(statut="valide", type_absence="formation").aggregate(total=Sum("nombre_heures_calcule"))["total"] or 0)

    affectations = AffectationProjet.objects.filter(utilisateur=utilisateur).exclude(statut_charge__in=["terminee", "suspendue"])
    affectations = affectations.filter(
        Q(date_debut_prevue__isnull=True) | Q(date_debut_prevue__lte=fin),
        Q(date_fin_prevue__isnull=True) | Q(date_fin_prevue__gte=debut),
    )
    heures_deja_affectees = Decimal("0.00")
    for affectation in affectations:
        heures_deja_affectees += _d(affectation.heures_restantes_estimees or affectation.heures_objectif)
    heures_deja_affectees = _q(heures_deja_affectees)

    heures_deja_realisees = _q(
        TempsPasse.objects.filter(utilisateur=utilisateur, date_saisie__range=(debut, fin))
        .aggregate(total=Sum("nb_heures"))["total"] or 0
    )
    heures_pointees = sum(
        (pointage.heures_travaillees for pointage in PointageJournalier.objects.filter(utilisateur=utilisateur, date__range=(debut, fin))),
        Decimal("0.00"),
    )
    heures_pointees = _q(heures_pointees)

    capacite_nette = max(Decimal("0.00"), heures_theoriques - heures_absences_validees - heures_formation)
    heures_disponibles = max(Decimal("0.00"), capacite_nette - heures_deja_affectees)
    taux_charge = _q(heures_deja_affectees / capacite_nette, "0.0001") if capacite_nette > 0 else Decimal("1.0000")
    disponibilite = max(Decimal("0.0000"), min(Decimal("1.0000"), Decimal("1.0000") - taux_charge))

    alertes = []
    if capacite_nette <= 0:
        alertes.append("Salarié indisponible sur la période")
    if taux_charge > Decimal("1.0000"):
        alertes.append("Charge prévisionnelle supérieure à 100 %")
    if heures_absences_validees > 0:
        alertes.append("Absence validée pendant la période")
    if heures_absences_attente > 0:
        alertes.append("Absence en attente pendant la période")
    if heures_formation > 0:
        alertes.append("Formation prévue")

    return {
        "utilisateur": str(utilisateur.id),
        "nom_complet": utilisateur.nom_complet,
        "profil": getattr(getattr(utilisateur, "profil", None), "libelle", ""),
        "profil_horaire": str(profil.profil_horaire_societe_id or ""),
        "profil_horaire_libelle": getattr(profil.profil_horaire_societe, "libelle", ""),
        "date_debut": debut,
        "date_fin": fin,
        "heures_theoriques": heures_theoriques,
        "heures_absences_validees": heures_absences_validees,
        "heures_absences_en_attente": heures_absences_attente,
        "heures_formation": heures_formation,
        "heures_deja_affectees": heures_deja_affectees,
        "heures_deja_realisees": heures_deja_realisees,
        "heures_pointees": heures_pointees,
        "heures_disponibles": _q(heures_disponibles),
        "taux_charge": taux_charge,
        "disponibilite": _q(disponibilite, "0.0001"),
        "alertes": alertes,
    }


def calculer_charge_previsionnelle(utilisateur: Utilisateur, date_debut=None, date_fin=None) -> dict[str, Decimal]:
    capacite = calculer_capacite_salarie(utilisateur, date_debut, date_fin)
    reste = max(Decimal("0.00"), capacite["heures_deja_affectees"] - capacite["heures_deja_realisees"])
    return {
        "heures_objectif": capacite["heures_deja_affectees"],
        "heures_realisees": capacite["heures_deja_realisees"],
        "heures_restantes": _q(reste),
        "taux_charge": capacite["taux_charge"],
    }


def calculer_score_assignation(utilisateur: Utilisateur, projet, mission_livrable=None, date_debut=None, date_fin=None, heures_objectif=None, priorite="normale", profil_recherche="") -> dict[str, Any]:
    capacite = calculer_capacite_salarie(utilisateur, date_debut, date_fin)
    heures_objectif_d = _d(heures_objectif, "0")
    disponibilite = capacite["disponibilite"]
    taux_charge = capacite["taux_charge"]
    profil_horaire = capacite.get("profil_horaire_libelle", "")
    profil_compatible = not profil_recherche or profil_recherche.lower() in (profil_horaire or "").lower() or profil_recherche.lower() in (capacite.get("profil") or "").lower()
    continuite = AffectationProjet.objects.filter(projet=projet, utilisateur=utilisateur).exists()
    respect_echeance = Decimal("1.00") if capacite["heures_disponibles"] >= heures_objectif_d else Decimal("0.35")

    score = (
        disponibilite * Decimal("35")
        + (Decimal("1") if profil_compatible else Decimal("0.35")) * Decimal("25")
        + max(Decimal("0"), Decimal("1") - min(taux_charge, Decimal("1"))) * Decimal("20")
        + (Decimal("1") if continuite else Decimal("0.30")) * Decimal("10")
        + respect_echeance * Decimal("10")
    )
    if capacite["heures_disponibles"] <= 0:
        score = min(score, Decimal("20.00"))
    if capacite["taux_charge"] > 1:
        score = min(score, Decimal("35.00"))

    justification = (
        f"Salarié proposé car disponibilité estimée à {int(disponibilite * 100)} %, "
        f"charge prévisionnelle à {int(taux_charge * 100)} %, "
        f"{'profil compatible' if profil_compatible else 'profil à vérifier'}"
        f"{', continuité dossier' if continuite else ''}."
    )

    return {
        **capacite,
        "score": _q(score),
        "justification": justification,
        "profil_compatible": profil_compatible,
        "continuite_dossier": continuite,
        "niveau_confiance": _q(min(Decimal("1.00"), max(Decimal("0.10"), score / Decimal("100"))), "0.0001"),
    }


def proposer_assignations(projet, date_debut=None, date_fin=None, heures_objectif=None, priorite="normale", profil_recherche="") -> list[dict[str, Any]]:
    organisation = getattr(projet, "organisation", None)
    utilisateurs = Utilisateur.objects.filter(est_actif=True).select_related("profil", "organisation")
    if organisation:
        utilisateurs = utilisateurs.filter(organisation=organisation)
    suggestions = [
        calculer_score_assignation(
            utilisateur,
            projet,
            date_debut=date_debut,
            date_fin=date_fin,
            heures_objectif=heures_objectif,
            priorite=priorite,
            profil_recherche=profil_recherche,
        )
        for utilisateur in utilisateurs
    ]
    return sorted(suggestions, key=lambda item: item["score"], reverse=True)


def assigner_automatiquement(projet, utilisateur: Utilisateur, affectations: list[dict[str, Any]], cree_par=None) -> list[AffectationProjet]:
    creees = []
    for item in affectations:
        score = calculer_score_assignation(
            utilisateur,
            projet,
            date_debut=item.get("date_debut_prevue"),
            date_fin=item.get("date_fin_prevue"),
            heures_objectif=item.get("heures_objectif"),
            priorite=item.get("priorite") or "normale",
            profil_recherche=item.get("profil_recherche") or "",
        )
        heures_objectif = _q(item.get("heures_objectif") or 0)
        affectation, _ = AffectationProjet.objects.update_or_create(
            projet=projet,
            utilisateur=utilisateur,
            nature=item.get("nature") or "mission",
            code_cible=item.get("code_cible") or "",
            defaults={
                "libelle_cible": item.get("libelle_cible") or getattr(projet, "intitule", ""),
                "role": item.get("role") or "contribution",
                "commentaires": item.get("commentaires") or "Assignation automatique selon capacité RH",
                "date_debut_prevue": _date(item.get("date_debut_prevue")) if item.get("date_debut_prevue") else None,
                "date_fin_prevue": _date(item.get("date_fin_prevue")) if item.get("date_fin_prevue") else None,
                "heures_objectif": heures_objectif,
                "heures_restantes_estimees": _q(item.get("heures_restantes_estimees") or heures_objectif),
                "priorite": item.get("priorite") or "normale",
                "statut_charge": item.get("statut_charge") or "planifiee",
                "score_assignation": score["score"],
                "justification_assignation": {
                    "texte": score["justification"],
                    "alertes": score["alertes"],
                    "capacite": {
                        "heures_disponibles": str(score["heures_disponibles"]),
                        "taux_charge": str(score["taux_charge"]),
                    },
                },
                "assignee_automatiquement": True,
                "date_assignation": timezone.now(),
                "niveau_confiance_assignation": score["niveau_confiance"],
                "cree_par": cree_par,
            },
        )
        creees.append(affectation)
    return creees


def recalculer_compteur_temps(utilisateur: Utilisateur, date_debut=None, date_fin=None) -> CompteurTempsSalarie:
    debut, fin = _periode(date_debut, date_fin)
    capacite = calculer_capacite_salarie(utilisateur, debut, fin)
    heures_productives = _q(
        TempsPasse.objects.filter(utilisateur=utilisateur, date_saisie__range=(debut, fin), est_productif=True)
        .aggregate(total=Sum("nb_heures"))["total"] or 0
    )
    heures_non_productives = _q(
        TempsPasse.objects.filter(utilisateur=utilisateur, date_saisie__range=(debut, fin), est_productif=False)
        .aggregate(total=Sum("nb_heures"))["total"] or 0
    )
    heures_pointees = capacite["heures_pointees"]
    heures_normales = min(heures_pointees, capacite["heures_theoriques"])
    heures_supp = max(Decimal("0.00"), heures_pointees - capacite["heures_theoriques"])
    compteur, _ = CompteurTempsSalarie.objects.update_or_create(
        utilisateur=utilisateur,
        periode_debut=debut,
        periode_fin=fin,
        defaults={
            "heures_theoriques": capacite["heures_theoriques"],
            "heures_pointees": heures_pointees,
            "heures_normales": _q(heures_normales),
            "heures_supplementaires": _q(heures_supp),
            "heures_absence": capacite["heures_absences_validees"],
            "heures_formation": capacite["heures_formation"],
            "heures_productives": heures_productives,
            "heures_non_productives": heures_non_productives,
            "date_calcul": timezone.now(),
            "details_calcul": {"alertes": capacite["alertes"]},
        },
    )
    return compteur


def calculer_tableau_bord_rh(date_debut=None, date_fin=None, organisation=None) -> dict[str, Any]:
    debut, fin = _periode(date_debut, date_fin)
    utilisateurs = Utilisateur.objects.filter(est_actif=True)
    if organisation:
        utilisateurs = utilisateurs.filter(organisation=organisation)

    lignes = []
    totaux = {
        "heures_theoriques": Decimal("0.00"),
        "heures_pointees": Decimal("0.00"),
        "heures_productives": Decimal("0.00"),
        "heures_non_productives": Decimal("0.00"),
        "heures_absence": Decimal("0.00"),
        "heures_formation": Decimal("0.00"),
        "heures_supplementaires": Decimal("0.00"),
        "heures_objectivees": Decimal("0.00"),
        "heures_realisees": Decimal("0.00"),
    }

    for utilisateur in utilisateurs:
        capacite = calculer_capacite_salarie(utilisateur, debut, fin)
        compteur = recalculer_compteur_temps(utilisateur, debut, fin)
        ligne = {
            "utilisateur": str(utilisateur.id),
            "nom_complet": utilisateur.nom_complet,
            "profil": capacite.get("profil_horaire_libelle") or capacite.get("profil") or "",
            "heures_theoriques": compteur.heures_theoriques,
            "heures_pointees": compteur.heures_pointees,
            "heures_productives": compteur.heures_productives,
            "heures_non_productives": compteur.heures_non_productives,
            "heures_absence": compteur.heures_absence,
            "heures_formation": compteur.heures_formation,
            "heures_supplementaires": compteur.heures_supplementaires,
            "heures_objectivees": capacite["heures_deja_affectees"],
            "heures_realisees": capacite["heures_deja_realisees"],
            "heures_disponibles": capacite["heures_disponibles"],
            "taux_charge": capacite["taux_charge"],
            "alertes": capacite["alertes"],
        }
        lignes.append(ligne)
        totaux["heures_theoriques"] += compteur.heures_theoriques
        totaux["heures_pointees"] += compteur.heures_pointees
        totaux["heures_productives"] += compteur.heures_productives
        totaux["heures_non_productives"] += compteur.heures_non_productives
        totaux["heures_absence"] += compteur.heures_absence
        totaux["heures_formation"] += compteur.heures_formation
        totaux["heures_supplementaires"] += compteur.heures_supplementaires
        totaux["heures_objectivees"] += capacite["heures_deja_affectees"]
        totaux["heures_realisees"] += capacite["heures_deja_realisees"]

    taux_charge_moyen = _q(totaux["heures_objectivees"] / totaux["heures_theoriques"], "0.0001") if totaux["heures_theoriques"] > 0 else Decimal("0.0000")
    taux_occupation = _q(totaux["heures_productives"] / totaux["heures_pointees"], "0.0001") if totaux["heures_pointees"] > 0 else Decimal("0.0000")
    return {
        "periode": {"date_debut": debut, "date_fin": fin},
        "heures_theoriques": _q(totaux["heures_theoriques"]),
        "heures_pointees": _q(totaux["heures_pointees"]),
        "heures_productives": _q(totaux["heures_productives"]),
        "heures_non_productives": _q(totaux["heures_non_productives"]),
        "heures_absence": _q(totaux["heures_absence"]),
        "heures_formation": _q(totaux["heures_formation"]),
        "heures_supplementaires": _q(totaux["heures_supplementaires"]),
        "taux_charge_moyen": taux_charge_moyen,
        "taux_occupation_facturable": taux_occupation,
        "ecart_objectif_reel": _q(totaux["heures_realisees"] - totaux["heures_objectivees"]),
        "absences_validees": DemandeAbsence.objects.filter(statut="valide", date_debut__lte=fin, date_fin__gte=debut).count(),
        "absences_en_attente": DemandeAbsence.objects.filter(statut="soumis", date_debut__lte=fin, date_fin__gte=debut).count(),
        "salaries": lignes,
    }

