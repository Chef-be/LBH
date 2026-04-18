"""Vues API pour les appels d'offres — Plateforme LBH."""

from rest_framework import generics, permissions, status, filters
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from .models import AppelOffres, OffreEntreprise
from .serialiseurs import (
    AppelOffresListeSerialiseur,
    AppelOffresDetailSerialiseur,
    OffreEntrepriseSerialiseur,
)


class VueListeAppelsOffres(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["intitule", "projet__reference", "type_procedure"]
    ordering = ["-date_creation"]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return AppelOffresDetailSerialiseur
        return AppelOffresListeSerialiseur

    def get_queryset(self):
        qs = AppelOffres.objects.select_related("projet", "lot").prefetch_related("offres")
        projet_id = self.request.query_params.get("projet")
        if projet_id:
            qs = qs.filter(projet_id=projet_id)
        statut = self.request.query_params.get("statut")
        if statut:
            qs = qs.filter(statut=statut)
        return qs


class VueDetailAppelOffres(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = AppelOffresDetailSerialiseur

    def get_queryset(self):
        return AppelOffres.objects.select_related("projet", "lot").prefetch_related(
            "offres__entreprise"
        )

    def destroy(self, request, *args, **kwargs):
        ao = self.get_object()
        if ao.statut in ("attribue", "publie"):
            return Response(
                {"detail": "Un appel d'offres publié ou attribué ne peut pas être supprimé."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        ao.statut = "abandonne"
        ao.save(update_fields=["statut"])
        return Response({"detail": "Appel d'offres abandonné."})


class VueListeOffres(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = OffreEntrepriseSerialiseur

    def get_queryset(self):
        return OffreEntreprise.objects.filter(
            appel_offres_id=self.kwargs["ao_id"]
        ).select_related("entreprise")

    def perform_create(self, serializer):
        ao = generics.get_object_or_404(AppelOffres, pk=self.kwargs["ao_id"])
        serializer.save(appel_offres=ao)


class VueDetailOffre(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = OffreEntrepriseSerialiseur

    def get_queryset(self):
        return OffreEntreprise.objects.filter(appel_offres_id=self.kwargs["ao_id"])


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def vue_attribuer_marche(request, ao_id, offre_id):
    """Attribue le marché à une offre — marque les autres comme rejetées."""
    ao = generics.get_object_or_404(AppelOffres, pk=ao_id)
    offre = generics.get_object_or_404(OffreEntreprise, pk=offre_id, appel_offres=ao)

    OffreEntreprise.objects.filter(appel_offres=ao).exclude(pk=offre_id).update(statut="rejetee")
    offre.statut = "retenue"
    offre.save(update_fields=["statut"])

    ao.statut = "attribue"
    ao.save(update_fields=["statut"])

    return Response({"detail": f"Marché attribué à « {offre.entreprise.nom} »."})


def _calculer_note_prix(montant: float, montants_valides: list, estimation: float | None, methode: str) -> float:
    """
    Calcule la note prix (0-100) d'une offre selon la méthode choisie.
    Toutes les méthodes retournent 100 pour le meilleur candidat.
    """
    if not montants_valides or montant <= 0:
        return 0.0

    montant_min = min(montants_valides)
    montant_moy = sum(montants_valides) / len(montants_valides)

    if methode == "proportionnelle_moins_disante":
        # Note = (min / offre) × 100 → toujours ≤ 100
        return min(montant_min / montant * 100, 100.0)

    elif methode == "lineaire_ecart_moins_disante":
        # 100 pts à la moins-disante, décroissance linéaire, 0 pts à +30%
        ecart = (montant - montant_min) / montant_min
        return max(0.0, 100.0 * (1 - ecart / 0.30))

    elif methode == "lineaire_ecart_estimation":
        if estimation and estimation > 0:
            ecart_abs = abs(montant - estimation) / estimation
            return max(0.0, 100.0 * (1 - ecart_abs / 0.30))
        # Fallback : proportionnelle à la moins-disante
        return min(montant_min / montant * 100, 100.0)

    elif methode == "ecart_moyenne_offres":
        # 100 pts si = à la moyenne, décroissance selon écart à la moyenne
        if montant_moy > 0:
            ecart_abs = abs(montant - montant_moy) / montant_moy
            return max(0.0, 100.0 * (1 - ecart_abs / 0.30))
        return 0.0

    elif methode in ("bareme_parametrable", "formule_personnalisee"):
        # Fallback : proportionnelle
        return min(montant_min / montant * 100, 100.0)

    else:
        return min(montant_min / montant * 100, 100.0)


def _est_critere_prix(libelle: str) -> bool:
    """Détecte si un critère représente le prix."""
    mots_cles = {"prix", "montant", "coût", "cout", "financier", "tarif", "valeur"}
    return any(m in libelle.lower() for m in mots_cles)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def vue_analyser_offres(request, ao_id):
    """
    Calcule la note globale de chaque offre selon les critères de jugement.
    Les critères « prix » sont auto-calculés depuis montant_offre_ht selon methode_prix.
    Les autres critères utilisent les notes manuelles (notes_criteres).
    """
    ao = generics.get_object_or_404(
        AppelOffres.objects.prefetch_related("offres__entreprise"), pk=ao_id
    )

    if not ao.criteres_jugement:
        return Response(
            {"detail": "Aucun critère de jugement défini."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    methode_prix = request.data.get("methode_prix", "proportionnelle_moins_disante")
    total_poids = sum(c.get("ponderation_pct", 0) for c in ao.criteres_jugement)
    if total_poids == 0:
        return Response(
            {"detail": "La somme des pondérations est nulle."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    estimation = float(ao.montant_estime_ht) if ao.montant_estime_ht else None
    offres_avec_prix = [
        o for o in ao.offres.all()
        if o.montant_offre_ht is not None and float(o.montant_offre_ht) > 0
    ]
    montants_valides = [float(o.montant_offre_ht) for o in offres_avec_prix]

    resultats = []
    a_sauvegarder = []

    for offre in ao.offres.all():
        montant = float(offre.montant_offre_ht) if offre.montant_offre_ht else None
        note_totale = 0.0
        detail_criteres = []

        for critere in ao.criteres_jugement:
            libelle = critere.get("libelle", "")
            code = critere.get("code") or libelle
            ponderation = critere.get("ponderation_pct", 0)
            poids = ponderation / total_poids

            if _est_critere_prix(libelle) and montant:
                note_brute = _calculer_note_prix(montant, montants_valides, estimation, methode_prix)
                methode_appliquee = methode_prix
            else:
                note_brute = float(offre.notes_criteres.get(code, 0))
                methode_appliquee = "manuelle"

            note_ponderee = poids * note_brute
            note_totale += note_ponderee
            detail_criteres.append({
                "code": code,
                "libelle": libelle,
                "ponderation_pct": ponderation,
                "note_brute": round(note_brute, 2),
                "note_ponderee": round(note_ponderee, 2),
                "methode": methode_appliquee,
            })

        offre.note_globale = round(note_totale, 2)
        a_sauvegarder.append(offre)
        resultats.append({
            "offre_id": str(offre.id),
            "entreprise": offre.entreprise.nom,
            "montant_ht": float(offre.montant_offre_ht) if offre.montant_offre_ht else None,
            "montant_analyse_ht": float(offre.montant_negociee_ht or offre.montant_offre_ht or 0),
            "note_globale": float(offre.note_globale),
            "detail_criteres": detail_criteres,
        })

    # Tri par note décroissante, attribution des rangs
    resultats.sort(key=lambda x: x["note_globale"], reverse=True)
    for rang, r in enumerate(resultats, start=1):
        r["rang"] = rang

    # Sauvegarde en lot
    from django.db.models import F
    for offre in a_sauvegarder:
        offre.save(update_fields=["note_globale"])

    # Synthèse et sauvegarde sur l'AO
    montants_valides_resultats = [r["montant_ht"] for r in resultats if r["montant_ht"]]
    synthese = {
        "methode_prix": methode_prix,
        "offre_min_ht": min(montants_valides_resultats) if montants_valides_resultats else None,
        "offre_max_ht": max(montants_valides_resultats) if montants_valides_resultats else None,
        "offre_moyenne_ht": (
            sum(montants_valides_resultats) / len(montants_valides_resultats)
            if montants_valides_resultats else None
        ),
        "estimation_reference_ht": estimation,
        "resultats": [
            {
                "offre_id": r["offre_id"],
                "entreprise": r["entreprise"],
                "montant_analyse_ht": r["montant_analyse_ht"],
                "montant_ht": r["montant_ht"],
                "note_globale": r["note_globale"],
                "rang": r["rang"],
            }
            for r in resultats
        ],
    }
    ao.parametres_analyse = {"methode_prix": methode_prix}
    ao.synthese_analyse = synthese
    ao.save(update_fields=["parametres_analyse", "synthese_analyse"])

    return Response({"resultats": resultats, "synthese": synthese})
