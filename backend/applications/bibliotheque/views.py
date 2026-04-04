"""Vues API pour la bibliothèque de prix — Plateforme LBH."""

from pathlib import Path
from tempfile import TemporaryDirectory

from rest_framework import generics, permissions, status, filters
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from .models import LignePrixBibliotheque, SousDetailPrix
from .services import (
    generer_sous_details_depuis_composantes,
    importer_bordereau_depuis_fichier,
    importer_bordereaux_prix_references,
    importer_referentiel_prix_construction,
    recalculer_composantes_depuis_sous_details,
)
from .serialiseurs import (
    LignePrixBibliothequeListeSerialiseur,
    LignePrixBibliothequeDetailSerialiseur,
    LignePrixBibliothequeAvecSousDetailsSerialiseur,
    SousDetailPrixSerialiseur,
)


def _coerce_booleen(valeur):
    if isinstance(valeur, bool):
        return valeur
    if isinstance(valeur, str):
        return valeur.strip().lower() not in {"0", "false", "non", ""}
    return bool(valeur)


def _reponse_interdite_administration():
    return Response(
        {"detail": "Cette action est réservée au super-administrateur."},
        status=status.HTTP_403_FORBIDDEN,
    )


class VueListeBibliotheque(generics.ListCreateAPIView):
    """Recherche et création dans la bibliothèque de prix."""
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["code", "designation_courte", "designation_longue", "famille", "sous_famille"]
    ordering = ["famille", "sous_famille", "code"]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return LignePrixBibliothequeDetailSerialiseur
        return LignePrixBibliothequeListeSerialiseur

    def get_queryset(self):
        qs = LignePrixBibliotheque.objects.select_related("organisation", "projet", "auteur")

        niveau = self.request.query_params.get("niveau")
        if niveau:
            qs = qs.filter(niveau=niveau)

        famille = self.request.query_params.get("famille")
        if famille:
            qs = qs.filter(famille__iexact=famille)

        sous_famille = self.request.query_params.get("sous_famille")
        if sous_famille:
            qs = qs.filter(sous_famille__iexact=sous_famille)

        organisation_id = self.request.query_params.get("organisation")
        if organisation_id:
            qs = qs.filter(organisation_id=organisation_id)

        projet_id = self.request.query_params.get("projet")
        if projet_id:
            qs = qs.filter(projet_id=projet_id)

        statut = self.request.query_params.get("statut") or self.request.query_params.get("statut_validation")
        if statut:
            qs = qs.filter(statut_validation=statut)
        else:
            qs = qs.filter(statut_validation="valide")

        return qs

    def perform_create(self, serializer):
        serializer.save(auteur=self.request.user)


class VueDetailBibliotheque(generics.RetrieveUpdateDestroyAPIView):
    """Détail, modification et archivage d'une entrée de bibliothèque."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = LignePrixBibliothequeDetailSerialiseur
    queryset = LignePrixBibliotheque.objects.select_related("organisation", "projet", "auteur")

    def destroy(self, request, *args, **kwargs):
        entree = self.get_object()
        if request.user.est_super_admin:
            entree.delete()
            return Response({"detail": "Entrée supprimée définitivement."})
        entree.statut_validation = "obsolete"
        entree.save(update_fields=["statut_validation"])
        return Response({"detail": "Entrée archivée (statut : obsolète)."})


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def vue_valider_entree(request, pk):
    """Valide une entrée de bibliothèque (passe en statut 'valide')."""
    entree = generics.get_object_or_404(LignePrixBibliotheque, pk=pk)
    entree.statut_validation = "valide"
    entree.save(update_fields=["statut_validation"])
    return Response({"detail": "Entrée validée."})


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def vue_familles(request):
    """Retourne la liste des familles et sous-familles disponibles."""
    qs = LignePrixBibliotheque.objects.filter(
        statut_validation="valide"
    ).values("famille", "sous_famille").distinct().order_by("famille", "sous_famille")
    return Response(list(qs))


class VueDetailBibliothequeAvecSousDetails(generics.RetrieveAPIView):
    """Détail d'une entrée de bibliothèque avec ses sous-détails."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = LignePrixBibliothequeAvecSousDetailsSerialiseur
    queryset = LignePrixBibliotheque.objects.prefetch_related("sous_details__profil_main_oeuvre").select_related(
        "organisation", "projet", "auteur"
    )


class VueListeSousDetailPrix(generics.ListCreateAPIView):
    """Liste et création des sous-détails d'une ligne de bibliothèque."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = SousDetailPrixSerialiseur

    def get_queryset(self):
        return SousDetailPrix.objects.select_related("profil_main_oeuvre").filter(
            ligne_prix_id=self.kwargs["ligne_pk"]
        ).order_by("ordre")

    def perform_create(self, serializer):
        ligne = generics.get_object_or_404(LignePrixBibliotheque, pk=self.kwargs["ligne_pk"])
        serializer.save(ligne_prix=ligne)


class VueDetailSousDetailPrix(generics.RetrieveUpdateDestroyAPIView):
    """Détail, modification et suppression d'un sous-détail."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = SousDetailPrixSerialiseur

    def get_queryset(self):
        return SousDetailPrix.objects.select_related("profil_main_oeuvre").filter(ligne_prix_id=self.kwargs["ligne_pk"])


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def vue_recalculer_sous_details(request, pk):
    """Recalcule et met à jour les composantes de coût depuis les sous-détails."""
    entree = generics.get_object_or_404(LignePrixBibliotheque, pk=pk)
    totaux = recalculer_composantes_depuis_sous_details(entree)
    for champ, valeur in totaux.items():
        setattr(entree, champ, valeur)
    entree.save(update_fields=list(totaux.keys()))

    return Response({
        "detail": "Composantes recalculées depuis les sous-détails.",
        "debourse_sec_unitaire": str(totaux["debourse_sec_unitaire"]),
    })


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def vue_recalculer_bibliotheque(request):
    """Recalcule l'ensemble de la bibliothèque et génère les sous-détails absents si demandé."""
    regenerer_absents = _coerce_booleen(request.data.get("regenerer_absents", True))
    forcer_regeneration = _coerce_booleen(request.data.get("forcer_regeneration", False))

    qs = LignePrixBibliotheque.objects.prefetch_related("sous_details").all()

    statut_validation = request.data.get("statut_validation")
    if statut_validation:
        qs = qs.filter(statut_validation=statut_validation)

    famille = request.data.get("famille")
    if famille:
        qs = qs.filter(famille__iexact=famille)

    lignes_recalculees = 0
    lignes_regenerees = 0
    sous_details_generes = 0
    lignes_ignorees = 0

    for ligne in qs:
        if regenerer_absents:
            generes = generer_sous_details_depuis_composantes(ligne, forcer=forcer_regeneration)
            if generes > 0:
                lignes_regenerees += 1
                sous_details_generes += generes

        if not ligne.sous_details.exists():
            lignes_ignorees += 1
            continue

        totaux = recalculer_composantes_depuis_sous_details(ligne)
        for champ, valeur in totaux.items():
            setattr(ligne, champ, valeur)
        ligne.save(update_fields=list(totaux.keys()))
        lignes_recalculees += 1

    return Response(
        {
            "detail": "Bibliothèque recalculée.",
            "lignes_recalculees": lignes_recalculees,
            "lignes_regenerees": lignes_regenerees,
            "sous_details_generes": sous_details_generes,
            "lignes_ignorees": lignes_ignorees,
        }
    )


@api_view(["DELETE", "POST"])
@permission_classes([permissions.IsAuthenticated])
def vue_vider_bibliotheque(request):
    """Vide entièrement la bibliothèque de prix."""
    if not request.user.est_super_admin:
        return _reponse_interdite_administration()

    total = LignePrixBibliotheque.objects.count()
    details = LignePrixBibliotheque.objects.all().delete()
    return Response(
        {
            "detail": "Bibliothèque vidée.",
            "lignes_supprimees": total,
            "suppression_detail": details[1],
        }
    )


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def vue_importer_bordereaux_prix(request):
    """Importe les bordereaux de prix de référence présents dans le partage documentaire métier."""
    resultat = importer_bordereaux_prix_references(auteur=request.user)
    return Response(
        {
            "detail": "Import des bordereaux de prix terminé.",
            **resultat,
        },
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def vue_importer_bordereaux_fichiers(request):
    """Importe des bordereaux PDF téléversés manuellement."""
    fichiers = request.FILES.getlist("fichiers")
    if not fichiers:
        return Response(
            {"detail": "Téléverser au moins un fichier PDF à analyser."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    limite = request.data.get("limite")
    limite_normalisee = int(limite) if limite not in (None, "") else None

    total_lignes = 0
    total_crees = 0
    total_maj = 0
    fichiers_ignores = 0

    with TemporaryDirectory(prefix="lbh-bibliotheque-") as dossier_temporaire:
        racine = Path(dossier_temporaire)

        for fichier in fichiers:
            suffixe = Path(fichier.name).suffix.lower()
            if suffixe != ".pdf":
                fichiers_ignores += 1
                continue

            chemin = racine / Path(fichier.name).name
            with chemin.open("wb") as destination:
                for morceau in fichier.chunks():
                    destination.write(morceau)

            resultat = importer_bordereau_depuis_fichier(
                chemin,
                auteur=request.user,
                limite=limite_normalisee,
            )
            total_lignes += resultat["lignes"]
            total_crees += resultat["creees"]
            total_maj += resultat["mises_a_jour"]

    return Response(
        {
            "detail": "Import des fichiers terminé.",
            "fichiers": len(fichiers),
            "fichiers_ignores": fichiers_ignores,
            "lignes": total_lignes,
            "creees": total_crees,
            "mises_a_jour": total_maj,
        },
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def vue_importer_prix_construction(request):
    """Importe des fiches unitaires et leurs cahiers des charges depuis prix-construction.info."""
    urls = request.data.get("urls") or []
    url_unique = request.data.get("url")
    if url_unique:
        urls = [url_unique, *urls]
    urls = [url for url in urls if isinstance(url, str) and url.strip()]

    if not urls:
        return Response(
            {"detail": "Fournir au moins une URL à importer depuis prix-construction.info."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    limite = request.data.get("limite")
    limite_normalisee = int(limite) if limite not in (None, "") else None
    creer_articles_cctp = _coerce_booleen(request.data.get("creer_articles_cctp", True))

    resultat = importer_referentiel_prix_construction(
        urls_depart=urls,
        auteur=request.user,
        limite=limite_normalisee,
        creer_articles_cctp=creer_articles_cctp,
    )
    return Response(
        {
            "detail": "Import depuis prix-construction.info terminé.",
            **resultat,
        },
        status=status.HTTP_200_OK,
    )
