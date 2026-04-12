"""Vues API pour les pièces écrites — Plateforme LBH."""

from io import BytesIO

from django.conf import settings
from django.core.files.base import ContentFile
from django.http import FileResponse, HttpResponse
from django.urls import reverse
from rest_framework import generics, permissions, status, filters
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from .models import ModeleDocument, PieceEcrite, ArticleCCTP, LotCCTP, PrescriptionCCTP
from .office import (
    assurer_gabarit_bureautique,
    construire_url_editeur_collabora,
    creer_jeton_wopi_modele,
    definir_verrou_modele,
    extension_gabarit_modele,
    lire_contenu_gabarit,
    lire_verrou_modele,
    nom_affichage_gabarit,
    supprimer_verrou_modele,
    type_bureautique_modele,
    type_mime_gabarit_modele,
    verifier_jeton_wopi_modele,
)
from .services import (
    construire_donnees_fusion_piece,
    exporter_piece_ecrite,
    generer_piece_depuis_modele,
    importer_fichier_word_en_html,
    proposer_article_cctp_assiste,
    regenerer_piece_ecrite,
    televerser_image_editeur,
)
from .serialiseurs import (
    ModeleDocumentSerialiseur,
    PieceEcriteListeSerialiseur,
    PieceEcriteDetailSerialiseur,
    ArticleCCTPSerialiseur,
    LotCCTPSerialiseur,
    PrescriptionCCTPSerialiseur,
    GenerateurCCTPCreationSerialiseur,
)


class VueListeModelesDocuments(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ModeleDocumentSerialiseur
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        qs = ModeleDocument.objects.all().order_by("type_document", "libelle")
        type_doc = self.request.query_params.get("type")
        if type_doc:
            qs = qs.filter(type_document=type_doc)
        inclure_inactifs = self.request.query_params.get("inclure_inactifs") == "1"
        if not inclure_inactifs or not self.request.user.est_super_admin:
            qs = qs.filter(est_actif=True)
        return qs

    def perform_create(self, serializer):
        if not self.request.user.est_super_admin:
            raise PermissionDenied("Seul un super-administrateur peut créer un modèle de document.")
        serializer.save()


class VueDetailModeleDocument(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ModeleDocumentSerialiseur
    queryset = ModeleDocument.objects.all().order_by("type_document", "libelle")
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def perform_update(self, serializer):
        if not self.request.user.est_super_admin:
            raise PermissionDenied("Seul un super-administrateur peut modifier un modèle de document.")
        serializer.save()

    def perform_destroy(self, instance):
        if not self.request.user.est_super_admin:
            raise PermissionDenied("Seul un super-administrateur peut supprimer un modèle de document.")
        instance.delete()


def _obtenir_jeton_wopi(request) -> str:
    jeton = request.GET.get("access_token", "")
    if jeton:
        return jeton
    autorisation = request.headers.get("Authorization", "")
    if autorisation.lower().startswith("bearer "):
        return autorisation[7:].strip()
    return ""


def _verifier_acces_wopi_modele(request, modele: ModeleDocument):
    try:
        return verifier_jeton_wopi_modele(modele, _obtenir_jeton_wopi(request))
    except PermissionError as exc:
        raise PermissionDenied(str(exc)) from exc


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def vue_modele_document_session_bureautique(request, pk):
    if not request.user.est_super_admin:
        raise PermissionDenied("Seul un super-administrateur peut ouvrir l'éditeur bureautique.")

    modele = generics.get_object_or_404(ModeleDocument, pk=pk)
    assurer_gabarit_bureautique(modele)

    jeton = creer_jeton_wopi_modele(modele, request.user)
    wopi_src = request.build_absolute_uri(
        reverse("modele-document-wopi-fichier", kwargs={"pk": modele.pk})
    )
    extension = extension_gabarit_modele(modele)
    url_editeur = construire_url_editeur_collabora(wopi_src, jeton, extension)

    return Response(
        {
            "url_editeur": url_editeur,
            "nom_fichier": nom_affichage_gabarit(modele),
            "type_bureautique": type_bureautique_modele(modele),
            "extension": extension,
            "access_token": jeton,
            "access_token_ttl": 8 * 60 * 60 * 1000,
            "gabarit": request.build_absolute_uri(modele.gabarit.url) if modele.gabarit else None,
        }
    )


@api_view(["GET", "POST"])
@permission_classes([permissions.AllowAny])
def vue_modele_document_wopi_fichier(request, pk):
    modele = generics.get_object_or_404(ModeleDocument, pk=pk)
    contexte = _verifier_acces_wopi_modele(request, modele)

    if request.method == "GET":
        contenu = lire_contenu_gabarit(modele)
        return Response(
            {
                "BaseFileName": nom_affichage_gabarit(modele),
                "OwnerId": str(modele.pk),
                "Size": len(contenu),
                "Version": str(int(modele.date_modification.timestamp())) if modele.date_modification else "1",
                "UserId": contexte["utilisateur_id"],
                "UserFriendlyName": f"Administrateur {getattr(settings, 'NOM_PLATEFORME', 'LBH Economiste')}",
                "UserCanWrite": True,
                "SupportsUpdate": True,
                "SupportsLocks": True,
                "SupportsGetLock": True,
                "UserCanNotWriteRelative": True,
                "DisablePrint": False,
                "DisableExport": False,
            }
        )

    override = (request.headers.get("X-WOPI-Override") or "").upper()
    verrou_existant = lire_verrou_modele(modele)
    verrou_demande = request.headers.get("X-WOPI-Lock", "")

    if override == "LOCK":
        if verrou_existant and verrou_existant != verrou_demande:
            reponse = HttpResponse(status=409)
            reponse["X-WOPI-Lock"] = verrou_existant
            return reponse
        definir_verrou_modele(modele, verrou_demande)
        return HttpResponse(status=200)

    if override == "GET_LOCK":
        reponse = HttpResponse(status=200)
        if verrou_existant:
            reponse["X-WOPI-Lock"] = verrou_existant
        return reponse

    if override == "REFRESH_LOCK":
        if verrou_existant and verrou_existant != verrou_demande:
            reponse = HttpResponse(status=409)
            reponse["X-WOPI-Lock"] = verrou_existant
            return reponse
        definir_verrou_modele(modele, verrou_demande)
        return HttpResponse(status=200)

    if override == "UNLOCK":
        if verrou_existant and verrou_existant != verrou_demande:
            reponse = HttpResponse(status=409)
            reponse["X-WOPI-Lock"] = verrou_existant
            return reponse
        supprimer_verrou_modele(modele)
        return HttpResponse(status=200)

    return HttpResponse(status=501)


@api_view(["GET", "POST"])
@permission_classes([permissions.AllowAny])
def vue_modele_document_wopi_contenu(request, pk):
    modele = generics.get_object_or_404(ModeleDocument, pk=pk)
    _verifier_acces_wopi_modele(request, modele)

    if request.method == "GET":
        contenu = lire_contenu_gabarit(modele)
        reponse = HttpResponse(contenu, content_type=type_mime_gabarit_modele(modele))
        reponse["Content-Length"] = str(len(contenu))
        return reponse

    override = (request.headers.get("X-WOPI-Override") or "").upper()
    if override != "PUT":
        return HttpResponse(status=501)

    verrou_existant = lire_verrou_modele(modele)
    verrou_demande = request.headers.get("X-WOPI-Lock", "")
    if verrou_existant and verrou_existant != verrou_demande:
        reponse = HttpResponse(status=409)
        reponse["X-WOPI-Lock"] = verrou_existant
        return reponse

    assurer_gabarit_bureautique(modele)
    modele.gabarit.save(modele.gabarit.name.split("/")[-1], ContentFile(request.body), save=False)
    modele.save(update_fields=["gabarit", "date_modification"])
    return HttpResponse(status=200)


class VueListePiecesEcrites(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["intitule", "projet__reference"]
    ordering = ["-date_modification"]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return PieceEcriteDetailSerialiseur
        return PieceEcriteListeSerialiseur

    def get_queryset(self):
        qs = PieceEcrite.objects.select_related("projet", "lot", "modele", "redacteur")
        projet_id = self.request.query_params.get("projet")
        if projet_id:
            qs = qs.filter(projet_id=projet_id)
        statut = self.request.query_params.get("statut")
        if statut:
            qs = qs.filter(statut=statut)
        return qs

    def perform_create(self, serializer):
        piece = serializer.save(redacteur=self.request.user)
        if piece.modele_id:
            generer_piece_depuis_modele(piece)


class VueDetailPieceEcrite(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = PieceEcriteDetailSerialiseur

    def get_queryset(self):
        return PieceEcrite.objects.select_related(
            "projet", "lot", "modele", "redacteur"
        ).prefetch_related("articles")

    def destroy(self, request, *args, **kwargs):
        piece = self.get_object()
        if request.user.est_super_admin:
            intitule = piece.intitule
            piece.delete()
            return Response({"detail": f"Pièce écrite « {intitule} » supprimée définitivement."})
        piece.statut = "archive"
        piece.save(update_fields=["statut"])
        return Response({"detail": "Pièce écrite archivée."})


class VueListeArticlesCCTP(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ArticleCCTPSerialiseur
    filter_backends = [filters.SearchFilter]
    search_fields = ["intitule", "corps_article", "chapitre"]

    def get_queryset(self):
        piece_id = self.kwargs.get("piece_id")
        if piece_id:
            return ArticleCCTP.objects.filter(piece_ecrite_id=piece_id)
        return ArticleCCTP.objects.filter(est_dans_bibliotheque=True)

    def perform_create(self, serializer):
        piece_id = self.kwargs.get("piece_id")
        if piece_id:
            piece = generics.get_object_or_404(PieceEcrite, pk=piece_id)
            serializer.save(piece_ecrite=piece)
        else:
            serializer.save()


class VueDetailArticleCCTP(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ArticleCCTPSerialiseur

    def get_queryset(self):
        piece_id = self.kwargs.get("piece_id")
        if piece_id:
            return ArticleCCTP.objects.filter(piece_ecrite_id=piece_id)
        return ArticleCCTP.objects.all()


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def vue_valider_piece_ecrite(request, pk):
    piece = generics.get_object_or_404(PieceEcrite, pk=pk)
    piece.statut = "valide"
    piece.save(update_fields=["statut"])
    return Response({"detail": "Pièce écrite validée."})


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def vue_generer_piece_ecrite(request, pk):
    piece = generics.get_object_or_404(PieceEcrite, pk=pk)
    regenerer_piece_ecrite(piece)
    serialiseur = PieceEcriteDetailSerialiseur(piece, context={"request": request})
    return Response(
        {
            "detail": "Pièce écrite générée à partir des articles.",
            "piece": serialiseur.data,
        }
    )


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def vue_proposition_article_cctp(request, pk):
    piece = generics.get_object_or_404(PieceEcrite, pk=pk)
    proposition = proposer_article_cctp_assiste(piece, request.data or {})
    return Response({"detail": "Brouillon d'article CCTP généré.", "article": proposition})


@api_view(["GET", "POST"])
@permission_classes([permissions.IsAuthenticated])
def vue_generer_piece_depuis_modele(request, pk):
    piece = generics.get_object_or_404(PieceEcrite, pk=pk)

    if request.method == "POST":
        variables = request.data.get("variables_personnalisees")
        if isinstance(variables, dict):
            piece.variables_personnalisees = variables
            piece.save(update_fields=["variables_personnalisees", "date_modification"])
        generer_piece_depuis_modele(piece)
        serialiseur = PieceEcriteDetailSerialiseur(piece, context={"request": request})
        return Response(
            {
                "detail": "Pièce écrite générée à partir du modèle.",
                "fusion": construire_donnees_fusion_piece(piece),
                "piece": serialiseur.data,
            }
        )

    return Response(
        {
            "fusion": construire_donnees_fusion_piece(piece),
            "variables_personnalisees": piece.variables_personnalisees,
            "modele": ModeleDocumentSerialiseur(piece.modele, context={"request": request}).data,
        }
    )


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def vue_exporter_piece_ecrite(request, pk, format_sortie):
    piece = generics.get_object_or_404(PieceEcrite, pk=pk)
    try:
        contenu, type_mime, nom_fichier = exporter_piece_ecrite(piece, format_sortie)
    except ValueError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    reponse = FileResponse(
        BytesIO(contenu),
        as_attachment=True,
        filename=nom_fichier,
        content_type=type_mime,
    )
    reponse["Content-Length"] = str(len(contenu))
    return reponse


@api_view(["POST"])
@parser_classes([MultiPartParser, FormParser, JSONParser])
@permission_classes([permissions.IsAuthenticated])
def vue_televerser_image_editeur(request):
    fichier = request.FILES.get("fichier")
    if not fichier:
        return Response({"detail": "Aucun fichier image reçu."}, status=status.HTTP_400_BAD_REQUEST)

    if not (fichier.content_type or "").startswith("image/"):
        return Response(
            {"detail": "Seules les images sont acceptées dans l'éditeur."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    url = televerser_image_editeur(fichier)
    return Response({"url": request.build_absolute_uri(url), "chemin": url})


@api_view(["POST"])
@parser_classes([MultiPartParser, FormParser, JSONParser])
@permission_classes([permissions.IsAuthenticated])
def vue_importer_fichier_word_editeur(request):
    fichier = request.FILES.get("fichier")
    if not fichier:
        return Response({"detail": "Aucun fichier Word reçu."}, status=status.HTTP_400_BAD_REQUEST)

    nom = (fichier.name or "").lower()
    if not nom.endswith(".docx"):
        return Response(
            {"detail": "Seuls les fichiers .docx sont pris en charge pour l'import Word."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        resultat = importer_fichier_word_en_html(
            fichier,
            construire_url_absolue=request.build_absolute_uri,
        )
    except RuntimeError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
    except Exception as exc:
        return Response({"detail": f"Import Word impossible : {exc}"}, status=status.HTTP_400_BAD_REQUEST)

    return Response(resultat)


class VueListeLotsTypesCCTP(generics.ListAPIView):
    """Liste tous les lots CCTP disponibles avec leurs chapitres."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = LotCCTPSerialiseur

    def get_queryset(self):
        return LotCCTP.objects.filter(est_actif=True).prefetch_related("chapitres__prescriptions")


class VueListePrescriptionsLot(generics.ListAPIView):
    """Liste les prescriptions d'un lot donné."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = PrescriptionCCTPSerialiseur

    def get_queryset(self):
        lot_numero = self.kwargs.get("lot_numero")
        qs = PrescriptionCCTP.objects.filter(est_actif=True)
        if lot_numero:
            qs = qs.filter(lot__numero=lot_numero)
        type_p = self.request.query_params.get("type")
        if type_p:
            qs = qs.filter(type_prescription=type_p)
        return qs.select_related("lot", "chapitre")


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def vue_generer_cctp_multi_lots(request):
    """
    Génère un CCTP Word complet depuis la sélection de lots et prescriptions.
    Body: {projet_id, intitule, lots: [...], prescriptions_exclues: [...], variables: {...}}
    """
    from applications.projets.models import Projet
    from .services import generer_cctp_depuis_bibliotheque

    serialiseur = GenerateurCCTPCreationSerialiseur(data=request.data, context={"request": request})
    if not serialiseur.is_valid():
        return Response(serialiseur.errors, status=status.HTTP_400_BAD_REQUEST)

    donnees = serialiseur.validated_data
    try:
        projet = Projet.objects.get(pk=donnees["projet_id"])
    except Projet.DoesNotExist:
        return Response({"erreur": "Projet introuvable."}, status=404)

    piece = generer_cctp_depuis_bibliotheque(
        projet=projet,
        intitule=donnees["intitule"],
        lots_numeros=donnees.get("lots", []),
        prescriptions_exclues_ids=donnees.get("prescriptions_exclues", []),
        variables=donnees.get("variables", {}),
        utilisateur=request.user,
    )
    return Response(PieceEcriteDetailSerialiseur(piece, context={"request": request}).data, status=201)
