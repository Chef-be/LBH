"""Vues API pour les études de voirie — Plateforme LBH."""

import sys
import os
from datetime import datetime, timezone

from rest_framework import generics, permissions, status, filters
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from .models import EtudeVoirie
from .serialiseurs import EtudeVoirieSerialiseur


class VueListeEtudesVoirie(generics.ListCreateAPIView):
    """Liste et création d'études de voirie."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = EtudeVoirieSerialiseur
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["intitule", "projet__reference", "type_voie"]
    ordering = ["-date_modification"]

    def get_queryset(self):
        qs = EtudeVoirie.objects.select_related("projet", "lot", "cree_par")
        projet_id = self.request.query_params.get("projet")
        if projet_id:
            qs = qs.filter(projet_id=projet_id)
        return qs

    def perform_create(self, serializer):
        serializer.save(cree_par=self.request.user)


class VueDetailEtudeVoirie(generics.RetrieveUpdateDestroyAPIView):
    """Détail, modification et suppression d'une étude de voirie."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = EtudeVoirieSerialiseur
    queryset = EtudeVoirie.objects.select_related("projet", "lot", "cree_par")


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def vue_calculer_voirie(request, pk):
    """
    Déclenche le calcul de dimensionnement de chaussée via le moteur SETRA/LCPC 1994.
    Stocke les résultats dans resultats_calcul et retourne la réponse complète.
    """
    etude = generics.get_object_or_404(EtudeVoirie, pk=pk)

    try:
        racine = os.path.dirname(
            os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        )
        if racine not in sys.path:
            sys.path.insert(0, racine)

        from calculs.voirie.moteur_chaussee import (
            ClasseDeformation,
            DonneesEntreeVoirie,
            ParametresCalculVoirie,
            TypeStructure,
            dimensionner_chaussee,
        )
        from applications.parametres.models import Parametre

        def _param(cle: str, defaut):
            try:
                return Parametre.objects.get(cle=cle).valeur_typee()
            except Exception:
                return defaut

        params = ParametresCalculVoirie(
            duree_vie_ans=int(etude.duree_vie_ans or _param("VOIRIE_DUREE_VIE_ANS", 20)),
            taux_croissance_annuel=float(
                etude.taux_croissance_annuel or _param("VOIRIE_TAUX_CROISSANCE_TRAFIC", 0.02)
            ),
        )

        donnees = DonneesEntreeVoirie(
            tmja_vl=etude.tmja_vl or 0,
            tmja_pl=etude.tmja_pl or 0,
            duree_vie_ans=etude.duree_vie_ans,
            cbr=etude.cbr,
            classe_plateforme=(
                ClasseDeformation(etude.classe_plateforme)
                if etude.classe_plateforme else None
            ),
            epaisseur_totale_max_cm=etude.epaisseur_totale_max_cm,
            type_structure_prefere=(
                TypeStructure(etude.type_structure_prefere)
                if etude.type_structure_prefere else None
            ),
            zone_climatique=etude.zone_climatique,
            proximite_eau=etude.proximite_eau,
        )

        resultat = dimensionner_chaussee(donnees, params)

        # Sérialisation du résultat en dict JSON-compatible
        resultats_json = {
            "classe_trafic": resultat.classe_trafic.value if hasattr(resultat.classe_trafic, "value") else str(resultat.classe_trafic),
            "classe_plateforme": resultat.classe_plateforme.value if hasattr(resultat.classe_plateforme, "value") else str(resultat.classe_plateforme),
            "ne_millions": float(resultat.trafic_cumule_pl),
            "couches": [
                {
                    "nom": couche.nom,
                    "materiau": couche.materiau,
                    "epaisseur_cm": float(couche.epaisseur_cm),
                    "module_mpa": float(couche.module_mpa) if couche.module_mpa is not None else None,
                }
                for couche in resultat.couches
            ],
            "epaisseur_totale_cm": float(resultat.epaisseur_totale_cm),
            "structure": resultat.type_structure.value if hasattr(resultat.type_structure, "value") else str(resultat.type_structure),
            "conforme": resultat.conforme,
            "avertissements": resultat.avertissements,
            "justification": resultat.justification,
        }

        etude.resultats_calcul = resultats_json
        etude.calcul_conforme = resultat.conforme
        etude.date_calcul = datetime.now(tz=timezone.utc)
        etude.save(update_fields=["resultats_calcul", "calcul_conforme", "date_calcul"])

        return Response({
            "detail": "Calcul effectué avec succès.",
            "resultats": resultats_json,
        })

    except ImportError as exc:
        return Response(
            {"detail": f"Moteur de calcul indisponible : {exc}"},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    except Exception as exc:
        return Response(
            {"detail": f"Erreur lors du calcul : {exc}"},
            status=status.HTTP_400_BAD_REQUEST,
        )
