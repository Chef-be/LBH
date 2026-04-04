"""
Vues de rentabilité — Plateforme LBH.
Analyses et simulations de marges à partir des données d'économie.
"""

from rest_framework import permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from applications.economie.models import EtudeEconomique, LignePrix


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def vue_analyse_rentabilite_projet(request, projet_id):
    """
    Synthèse de rentabilité de toutes les études économiques d'un projet.
    Retourne les totaux agrégés et la répartition par étude.
    """
    etudes = EtudeEconomique.objects.filter(
        projet_id=projet_id, statut__in=["en_cours", "a_valider", "validee"]
    ).select_related("lot")

    if not etudes.exists():
        return Response({
            "detail": "Aucune étude économique active pour ce projet.",
            "etudes": [],
        })

    total_prix_vente = sum(e.total_prix_vente for e in etudes)
    total_marge_nette = sum(e.total_marge_nette for e in etudes)
    taux_global = (
        float(total_marge_nette / total_prix_vente)
        if total_prix_vente
        else 0.0
    )

    detail_etudes = []
    for etude in etudes:
        lignes_non_rentables = LignePrix.objects.filter(
            etude=etude,
            etat_rentabilite__in=["non_rentable", "deficitaire_origine"],
        ).count()
        detail_etudes.append({
            "id": str(etude.id),
            "intitule": etude.intitule,
            "lot": etude.lot.intitule if etude.lot else None,
            "statut": etude.statut,
            "total_prix_vente": float(etude.total_prix_vente),
            "total_marge_nette": float(etude.total_marge_nette),
            "taux_marge_nette_global": float(etude.taux_marge_nette_global),
            "nb_lignes_non_rentables": lignes_non_rentables,
        })

    return Response({
        "projet_id": str(projet_id),
        "nb_etudes": len(detail_etudes),
        "total_prix_vente": float(total_prix_vente),
        "total_marge_nette": float(total_marge_nette),
        "taux_marge_nette_global": round(taux_global, 4),
        "etudes": detail_etudes,
    })


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def vue_simulation_marge(request, etude_id):
    """
    Simule l'impact d'une modification de taux sur la marge d'une étude.
    Corps attendu : {taux_marge, taux_frais_generaux, taux_aleas}
    Retourne la nouvelle marge sans modifier les données.
    """
    etude = EtudeEconomique.objects.select_related("projet").get(pk=etude_id)

    # Paramètres de simulation
    taux_marge = float(request.data.get("taux_marge", etude.taux_marge_cible or 0.10))
    taux_fg = float(request.data.get("taux_frais_generaux", etude.taux_frais_generaux or 0.12))
    taux_aleas = float(request.data.get("taux_aleas", etude.taux_aleas or 0.03))

    # Simulation sur les totaux existants
    debourse_sec = float(etude.total_debourse_sec)
    cout_direct = debourse_sec * (1 + float(etude.taux_frais_chantier or 0.08))
    cout_revient = cout_direct * (1 + taux_fg + taux_aleas)
    prix_vente_simule = cout_revient / (1 - taux_marge) if taux_marge < 1 else cout_revient
    marge_nette_simulee = prix_vente_simule - cout_revient

    return Response({
        "etude_id": str(etude.id),
        "intitule": etude.intitule,
        "parametres_simulation": {
            "taux_marge": taux_marge,
            "taux_frais_generaux": taux_fg,
            "taux_aleas": taux_aleas,
        },
        "resultats": {
            "total_debourse_sec": debourse_sec,
            "total_cout_direct": round(cout_direct, 2),
            "total_cout_revient": round(cout_revient, 2),
            "total_prix_vente_simule": round(prix_vente_simule, 2),
            "total_marge_nette_simulee": round(marge_nette_simulee, 2),
            "taux_marge_nette_effectif": round(marge_nette_simulee / prix_vente_simule, 4)
            if prix_vente_simule
            else 0.0,
        },
        "ecart_vs_actuel": {
            "prix_vente": round(prix_vente_simule - float(etude.total_prix_vente), 2),
            "marge_nette": round(marge_nette_simulee - float(etude.total_marge_nette), 2),
        },
    })
