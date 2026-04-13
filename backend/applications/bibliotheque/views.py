"""Vues API pour la bibliothèque de prix — Plateforme LBH."""

from pathlib import Path
from tempfile import TemporaryDirectory

from rest_framework import generics, permissions, status, filters
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from .models import LignePrixBibliotheque, SousDetailPrix
from .services import (
    completer_sous_details_manquants,
    generer_sous_details_depuis_composantes,
    importer_bordereau_depuis_fichier,
    importer_bordereaux_prix_references,
    importer_referentiel_prix_construction,
    recalculer_composantes_depuis_sous_details,
    recalculer_depuis_prix_vente,
)
from .serialiseurs import (
    LignePrixBibliothequeListeSerialiseur,
    LignePrixBibliothequeDetailSerialiseur,
    LignePrixBibliothequeAvecSousDetailsSerialiseur,
    LignePrixBibliothequeCompletSerialiseur,
    LotCCTPResumeSerialiseur,
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


class VueDetailBibliothequeComplet(generics.RetrieveAPIView):
    """Détail complet d'une entrée : sous-détails, prescriptions CCTP liées, répartition DS."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = LignePrixBibliothequeCompletSerialiseur
    queryset = LignePrixBibliotheque.objects.prefetch_related(
        "sous_details__profil_main_oeuvre",
        "prescriptions_liees__lot",
    ).select_related("organisation", "projet", "auteur", "lot_cctp_reference")


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
    """
    Recalcule une ligne par étude de prix inversée analytique.
    Stratégie :
    1. Sous-détails existants → recalcul classique + vérification cohérence PV
    2. PV connu, pas de sous-détails → DS = PV × Kpv inverse (Cusant & Widloecher)
       puis décomposition par ratios ARTIPRIX 2025
    3. Ni sous-détails ni PV → erreur 400
    """
    from .taches import recalculer_ligne_inverse

    entree = generics.get_object_or_404(LignePrixBibliotheque, pk=pk)
    composantes, methode = recalculer_ligne_inverse(entree)

    if not composantes:
        return Response(
            {"detail": "Aucun sous-détail ni prix de vente disponible pour recalculer."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    for champ, valeur in composantes.items():
        setattr(entree, champ, valeur)
    entree.save(update_fields=list(composantes.keys()) + ["date_modification"])

    libelle_methode = {
        "sous_details": "Recalcul depuis sous-détails.",
        "inversees": "Étude de prix inversée (DS = PV × Kpv).",
        "affinees": "Sous-détails affinés par étude inversée (écart > 30%).",
    }.get(methode, "Recalcul effectué.")

    return Response({
        "detail": libelle_methode,
        "methode": methode,
        "debourse_sec_unitaire": str(composantes.get("debourse_sec_unitaire", "0")),
        "cout_matieres": str(composantes.get("cout_matieres", "0")),
        "cout_materiel": str(composantes.get("cout_materiel", "0")),
        "temps_main_oeuvre": str(composantes.get("temps_main_oeuvre", "0")),
        "cout_horaire_mo": str(composantes.get("cout_horaire_mo", "0")),
    })


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def vue_completer_sous_details(request, pk):
    """
    Complète les sous-détails d'une ligne en ajoutant les composantes manquantes
    (matériaux, matériel, frais divers) depuis les champs agrégés, sans toucher
    aux sous-détails existants.
    """
    entree = generics.get_object_or_404(LignePrixBibliotheque, pk=pk)
    nb_ajoutes = completer_sous_details_manquants(entree)
    return Response({
        "detail": f"{nb_ajoutes} sous-détail(s) ajouté(s).",
        "nb_ajoutes": nb_ajoutes,
    })


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def vue_completer_tous_sous_details(request):
    """
    Complète les sous-détails de toute la bibliothèque.
    Ajoute les composantes manquantes depuis les champs agrégés.
    """
    lignes = LignePrixBibliotheque.objects.all()
    total_ajoutes = 0
    lignes_traitees = 0
    for ligne in lignes.iterator(chunk_size=500):
        nb = completer_sous_details_manquants(ligne)
        total_ajoutes += nb
        if nb > 0:
            lignes_traitees += 1
    return Response({
        "detail": f"{total_ajoutes} sous-détail(s) ajouté(s) sur {lignes_traitees} ligne(s).",
        "total_ajoutes": total_ajoutes,
        "lignes_traitees": lignes_traitees,
    })


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def vue_recalculer_bibliotheque(request):
    """
    Lance le recalcul asynchrone de toute la bibliothèque via Celery.
    Retourne immédiatement un tache_id pour suivre la progression.
    La progression est accessible via GET /recalcul-progression/<tache_id>/
    """
    import uuid
    from .taches import tache_recalculer_bibliotheque, cle_progression
    from django.core.cache import cache

    tache_id = str(uuid.uuid4())
    filtre_statut = request.data.get("statut_validation") or None
    filtre_famille = request.data.get("famille") or None

    # Initialiser la progression avant de lancer la tâche
    cache.set(cle_progression(tache_id), {
        "statut": "en_attente", "traites": 0, "total": 0,
        "pourcentage": 0, "message": "En attente de démarrage...",
    }, timeout=3600)

    tache_recalculer_bibliotheque.delay(
        tache_id=tache_id,
        filtre_statut=filtre_statut,
        filtre_famille=filtre_famille,
    )

    return Response({
        "detail": "Recalcul lancé en arrière-plan.",
        "tache_id": tache_id,
    }, status=status.HTTP_202_ACCEPTED)


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def vue_progression_recalcul(request, tache_id):
    """Retourne la progression d'un recalcul en cours ou terminé."""
    from .taches import cle_progression
    from django.core.cache import cache

    progression = cache.get(cle_progression(tache_id))
    if progression is None:
        return Response(
            {"detail": "Tâche introuvable ou expirée."},
            status=status.HTTP_404_NOT_FOUND,
        )
    return Response(progression)


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
def vue_lier_auto_prix_articles(request):
    """Lie automatiquement les lignes de prix aux articles CCTP par similarité de désignation."""
    from applications.pieces_ecrites.models import ArticleCCTP

    articles_sans_liaison = ArticleCCTP.objects.filter(
        ligne_prix_reference__isnull=True,
        est_dans_bibliotheque=True,
    ).select_related()

    lignes_prix = list(
        LignePrixBibliotheque.objects.values(
            "id", "designation_courte", "designation_longue"
        )
    )

    def _mots_significatifs(texte: str) -> set:
        """Extrait les mots de longueur > 4 caractères depuis un texte."""
        if not texte:
            return set()
        return {
            mot.lower()
            for mot in texte.replace("-", " ").split()
            if len(mot) > 4
        }

    liaisons_creees = 0
    articles_traites = 0

    for article in articles_sans_liaison:
        articles_traites += 1
        mots_article = _mots_significatifs(article.intitule)
        if len(mots_article) < 3:
            continue

        meilleure_ligne_id = None
        meilleur_score = 0

        for ligne in lignes_prix:
            mots_ligne = _mots_significatifs(
                (ligne["designation_courte"] or "") + " " + (ligne["designation_longue"] or "")
            )
            score = len(mots_article & mots_ligne)
            if score >= 3 and score > meilleur_score:
                meilleur_score = score
                meilleure_ligne_id = ligne["id"]

        if meilleure_ligne_id:
            try:
                ligne_ref = LignePrixBibliotheque.objects.get(pk=meilleure_ligne_id)
                article.ligne_prix_reference = ligne_ref
                article.save(update_fields=["ligne_prix_reference"])
                liaisons_creees += 1
            except LignePrixBibliotheque.DoesNotExist:
                pass

    return Response({
        "liaisons_creees": liaisons_creees,
        "articles_traites": articles_traites,
    })


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
    """Importe des bordereaux PDF ou Excel téléversés manuellement."""
    fichiers = request.FILES.getlist("fichiers")
    if not fichiers:
        return Response(
            {"detail": "Téléverser au moins un fichier PDF ou Excel à analyser."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    limite = request.data.get("limite")
    limite_normalisee = int(limite) if limite not in (None, "") else None

    total_lignes = 0
    total_crees = 0
    total_maj = 0
    fichiers_ignores = 0
    EXTENSIONS_ACCEPTEES = {".pdf", ".xlsx", ".xls"}

    with TemporaryDirectory(prefix="lbh-bibliotheque-") as dossier_temporaire:
        racine = Path(dossier_temporaire)

        for fichier in fichiers:
            suffixe = Path(fichier.name).suffix.lower()
            if suffixe not in EXTENSIONS_ACCEPTEES:
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


# ---------------------------------------------------------------------------
# Nouvelles vues : prescriptions CCTP liées et lots CCTP
# ---------------------------------------------------------------------------

@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def vue_prescriptions_liees(request, pk):
    """Retourne les prescriptions CCTP liées à une ligne de bibliothèque."""
    from applications.pieces_ecrites.serialiseurs import PrescriptionCCTPSerialiseur
    entree = generics.get_object_or_404(
        LignePrixBibliotheque.objects.prefetch_related("prescriptions_liees__lot"),
        pk=pk,
    )
    prescriptions = entree.prescriptions_liees.select_related("lot", "chapitre").filter(est_actif=True)
    serialiseur = PrescriptionCCTPSerialiseur(prescriptions, many=True)
    return Response(serialiseur.data)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def vue_lier_prescriptions(request, pk):
    """Lie des prescriptions CCTP à une ligne de bibliothèque. Body: {prescription_ids: [uuid...]}"""
    entree = generics.get_object_or_404(LignePrixBibliotheque, pk=pk)
    ids = request.data.get("prescription_ids", [])
    if not isinstance(ids, list):
        return Response(
            {"detail": "prescription_ids doit être une liste d'UUID."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    from applications.pieces_ecrites.models import PrescriptionCCTP
    prescriptions = PrescriptionCCTP.objects.filter(id__in=ids)
    entree.prescriptions_liees.set(prescriptions)
    return Response({"detail": f"{prescriptions.count()} prescription(s) liée(s)."})


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def vue_lots_cctp(request):
    """Liste des 18 lots CCTP disponibles pour filtrage et liaison."""
    from applications.pieces_ecrites.models import LotCCTP
    lots = LotCCTP.objects.filter(est_actif=True).order_by("ordre", "numero")
    serialiseur = LotCCTPResumeSerialiseur(lots, many=True)
    return Response(serialiseur.data)


@api_view(["GET", "PATCH"])
@permission_classes([permissions.IsAuthenticated])
def vue_caracteristiques(request, pk):
    """Lecture et mise à jour des caractéristiques techniques d'une ligne de bibliothèque."""
    entree = generics.get_object_or_404(LignePrixBibliotheque, pk=pk)
    if request.method == "GET":
        return Response({
            "caracteristiques_techniques": entree.caracteristiques_techniques,
            "conditions_mise_en_oeuvre": entree.conditions_mise_en_oeuvre,
        })
    # PATCH
    if "caracteristiques_techniques" in request.data:
        entree.caracteristiques_techniques = request.data["caracteristiques_techniques"]
    if "conditions_mise_en_oeuvre" in request.data:
        entree.conditions_mise_en_oeuvre = request.data["conditions_mise_en_oeuvre"]
    entree.save(update_fields=["caracteristiques_techniques", "conditions_mise_en_oeuvre"])
    return Response({
        "detail": "Caractéristiques mises à jour.",
        "caracteristiques_techniques": entree.caracteristiques_techniques,
        "conditions_mise_en_oeuvre": entree.conditions_mise_en_oeuvre,
    })
