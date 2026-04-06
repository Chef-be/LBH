"""Vues API pour la gestion documentaire — Plateforme LBH."""

import os
import json
import hashlib
import logging
import uuid
from datetime import datetime, timezone
from urllib import error as urllib_error
from urllib import request as urllib_request
from django.http import HttpResponse
from django.urls import reverse
from rest_framework import generics, permissions, status, filters
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from .models import TypeDocument, DossierDocumentProjet, Document, AnnotationDocument, DiffusionDocument
from .office import (
    assurer_fichier_bureautique_document,
    construire_url_editeur_collabora_document,
    creer_jeton_wopi_document,
    definir_verrou_document,
    extension_bureautique_document,
    lire_contenu_document,
    lire_verrou_document,
    nom_affichage_document,
    supprimer_verrou_document,
    type_bureautique_document,
    type_mime_bureautique_document,
    verifier_jeton_wopi_document,
    enregistrer_contenu_document,
)
from .services import (
    ErreurServiceAnalyse,
    appliquer_suggestions_document,
    analyser_document_automatiquement,
    determiner_dossier_cible_document,
    est_document_bureautique_editable,
    inferer_projet_initial,
    intitule_document_depuis_nom_fichier,
    importer_archive_documents,
    nom_stockage_document,
    obtenir_projet_unique,
    obtenir_ou_creer_dossier_document,
    reference_document_depuis_nom_fichier,
    reclasser_document_dans_ged,
    synchroniser_dossiers_projet,
    previsualiser_suggestions_document,
)
from .serialiseurs import (
    TypeDocumentSerialiseur,
    DossierDocumentProjetSerialiseur,
    DocumentListeSerialiseur,
    DocumentDetailSerialiseur,
    AnnotationDocumentSerialiseur,
    DiffusionDocumentSerialiseur,
)
from applications.bibliotheque.services import importer_document_economique_dans_bibliotheque

journal = logging.getLogger(__name__)


def _prefixe_plateforme() -> str:
    return (os.getenv("PREFIXE_CONTENEURS") or "lbh").strip() or "lbh"


def _construire_corps_multipart(nom_champ, nom_fichier, contenu, type_mime):
    """Construit un corps multipart simple sans dépendance externe."""
    delimiteur = f"{_prefixe_plateforme()}-{uuid.uuid4().hex}"
    en_tete = "\r\n".join(
        [
            f"--{delimiteur}",
            f'Content-Disposition: form-data; name="{nom_champ}"; filename="{nom_fichier}"',
            f"Content-Type: {type_mime}",
            "",
            "",
        ]
    ).encode("utf-8")
    pied = f"\r\n--{delimiteur}--\r\n".encode("utf-8")
    return delimiteur, en_tete + contenu + pied


def _obtenir_jeton_wopi(request) -> str:
    jeton = request.GET.get("access_token", "")
    if jeton:
        return jeton
    autorisation = request.headers.get("Authorization", "")
    if autorisation.lower().startswith("bearer "):
        return autorisation[7:].strip()
    return ""


def _verifier_acces_wopi_document(request, document: Document):
    try:
        return verifier_jeton_wopi_document(document, _obtenir_jeton_wopi(request))
    except PermissionError as exc:
        raise ValidationError(str(exc)) from exc


class VueListeTypesDocuments(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = TypeDocumentSerialiseur
    queryset = TypeDocument.objects.all()


class VueListeDossiersDocumentsProjet(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = DossierDocumentProjetSerialiseur
    filter_backends = [filters.OrderingFilter]
    ordering = ["ordre", "intitule"]

    def get_queryset(self):
        projet_id = self.request.query_params.get("projet") or self.kwargs.get("projet_id")
        queryset = DossierDocumentProjet.objects.select_related("projet", "parent")
        if projet_id:
            queryset = queryset.filter(projet_id=projet_id)
            if self.request.query_params.get("synchroniser", "1") != "0":
                projet = queryset.first().projet if queryset.exists() else None
                if not projet and projet_id:
                    from applications.projets.models import Projet

                    projet = Projet.objects.filter(pk=projet_id).first()
                if projet:
                    synchroniser_dossiers_projet(projet)
                    queryset = DossierDocumentProjet.objects.select_related("projet", "parent").filter(projet_id=projet_id)
        return queryset.order_by("ordre", "intitule")


class VueDetailDossierDocumentProjet(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = DossierDocumentProjetSerialiseur
    queryset = DossierDocumentProjet.objects.select_related("projet", "parent")


class VueListeDocuments(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["reference", "intitule", "contenu_texte"]
    ordering = ["-date_modification"]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return DocumentDetailSerialiseur
        return DocumentListeSerialiseur

    def get_queryset(self):
        qs = Document.objects.select_related(
            "type_document", "projet", "lot", "dossier", "auteur", "valide_par"
        ).filter(est_version_courante=True)

        projet_id = self.request.query_params.get("projet")
        if projet_id:
            qs = qs.filter(projet_id=projet_id)

        type_doc = self.request.query_params.get("type")
        if type_doc:
            qs = qs.filter(type_document__code=type_doc)

        dossier_id = self.request.query_params.get("dossier")
        if dossier_id:
            qs = qs.filter(dossier_id=dossier_id)

        est_version_courante = self.request.query_params.get("est_version_courante")
        if est_version_courante == "true":
            qs = qs.filter(est_version_courante=True)
        elif est_version_courante == "false":
            qs = qs.filter(est_version_courante=False)

        statut = self.request.query_params.get("statut")
        if statut:
            qs = qs.filter(statut=statut)

        confidentiel = self.request.query_params.get("confidentiel")
        if confidentiel == "0":
            qs = qs.filter(confidentiel=False)

        return qs

    def perform_create(self, serializer):
        fichier = self.request.FILES.get("fichier")
        extras = {}
        dossier_choisi_explicitement = bool(self.request.data.get("dossier"))
        projet = serializer.validated_data.get("projet") or obtenir_projet_unique()
        if not projet:
            projet = inferer_projet_initial(
                reference=self.request.data.get("reference", ""),
                intitule=self.request.data.get("intitule", ""),
                nom_fichier=fichier.name if fichier else "",
            )
        if not projet:
            raise ValidationError(
                {"projet": "Sélectionnez un projet ou utilisez une référence projet détectable automatiquement."}
            )

        type_document = serializer.validated_data.get("type_document")
        if not type_document:
            type_document = TypeDocument.objects.filter(code="AUTRE").first() or TypeDocument.objects.order_by("ordre_affichage").first()
        if not type_document:
            raise ValidationError({"type_document": "Aucun type de document n'est configuré."})

        if fichier:
            serializer.validated_data["reference"] = (
                serializer.validated_data.get("reference")
                or reference_document_depuis_nom_fichier(fichier.name)
            )[:100]
            serializer.validated_data["intitule"] = (
                serializer.validated_data.get("intitule")
                or intitule_document_depuis_nom_fichier(fichier.name)
            )[:500]
            extras["nom_fichier_origine"] = fichier.name
            extras["taille_octets"] = fichier.size
            extras["type_mime"] = fichier.content_type or ""
            # Calcul empreinte SHA-256
            h = hashlib.sha256()
            for bloc in fichier.chunks():
                h.update(bloc)
            extras["empreinte_sha256"] = h.hexdigest()
            fichier.name = nom_stockage_document(fichier.name)
            fichier.seek(0)
        dossier_id = self.request.data.get("dossier")
        if dossier_id:
            dossier = DossierDocumentProjet.objects.filter(pk=dossier_id, projet=projet).first()
            if not dossier:
                raise ValidationError({"dossier": "Le dossier sélectionné n'appartient pas au projet."})
            extras["dossier_id"] = str(dossier.id)
        else:
            cible = determiner_dossier_cible_document(
                projet,
                type_document_code=type_document.code,
                contexte_generation="document-importe",
            )
            dossier = obtenir_ou_creer_dossier_document(
                projet,
                cible["code"],
                parent_code=cible.get("parent_code"),
                intitule=cible["intitule"],
                parent_intitule=cible.get("parent_intitule"),
            )
            extras["dossier_id"] = str(dossier.id)
        document = serializer.save(
            auteur=self.request.user,
            projet=projet,
            type_document=type_document,
            **extras,
        )
        if document.fichier:
            try:
                analyser_document_automatiquement(document)
                if not dossier_choisi_explicitement:
                    reclasser_document_dans_ged(document, contexte_generation="document-importe", forcer=True)
            except ErreurServiceAnalyse as exc:
                journal.warning("Analyse automatique non disponible pour %s : %s", document.reference, str(exc))


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def vue_creer_document_bureautique(request):
    projet_id = request.data.get("projet")
    if not projet_id:
        raise ValidationError({"projet": "Le projet est obligatoire."})

    from applications.projets.models import Projet

    projet = generics.get_object_or_404(Projet, pk=projet_id)
    format_document = (request.data.get("format") or "docx").lower()
    if format_document not in {"docx", "xlsx"}:
        raise ValidationError({"format": "Formats autorisés : docx ou xlsx."})

    reference = (request.data.get("reference") or "").strip() or f"{projet.reference}-DOC"
    intitule = (request.data.get("intitule") or "").strip() or ("Nouveau tableau" if format_document == "xlsx" else "Nouveau document")

    type_document = None
    type_document_id = request.data.get("type_document")
    if type_document_id:
        type_document = TypeDocument.objects.filter(pk=type_document_id).first()
    if not type_document:
        code_defaut = "DPGF" if format_document == "xlsx" else "RAPPORT"
        type_document = TypeDocument.objects.filter(code=code_defaut).first()
    if not type_document:
        type_document = TypeDocument.objects.filter(code="AUTRE").first() or TypeDocument.objects.order_by("ordre_affichage").first()
    if not type_document:
        raise ValidationError({"type_document": "Aucun type de document n'est configuré."})

    dossier = None
    dossier_id = request.data.get("dossier")
    if dossier_id:
        dossier = DossierDocumentProjet.objects.filter(pk=dossier_id, projet=projet).first()
        if not dossier:
            raise ValidationError({"dossier": "Le dossier sélectionné n'appartient pas au projet."})
    else:
        cible = determiner_dossier_cible_document(projet, type_document_code=type_document.code, contexte_generation="document-bureautique")
        dossier = obtenir_ou_creer_dossier_document(
            projet,
            cible["code"],
            parent_code=cible.get("parent_code"),
            intitule=cible["intitule"],
            parent_intitule=cible.get("parent_intitule"),
        )

    nom_fichier = f"{nom_stockage_document(f'{intitule}.{format_document}')}"
    document = Document.objects.create(
        reference=reference[:100],
        intitule=intitule[:500],
        type_document=type_document,
        projet=projet,
        dossier=dossier,
        statut="brouillon",
        origine="interne",
        auteur=request.user,
        nom_fichier_origine=nom_fichier,
        type_mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" if format_document == "xlsx" else "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )
    assurer_fichier_bureautique_document(document)
    return Response(DocumentDetailSerialiseur(document, context={"request": request}).data, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def vue_document_session_bureautique(request, pk):
    document = generics.get_object_or_404(Document.objects.select_related("projet"), pk=pk)
    if not est_document_bureautique_editable(document.nom_fichier_origine, document.type_mime):
        raise ValidationError("Ce document n'est pas éditable dans Collabora.")

    assurer_fichier_bureautique_document(document)
    jeton = creer_jeton_wopi_document(document, request.user)
    wopi_src = request.build_absolute_uri(reverse("document-wopi-fichier", kwargs={"pk": document.pk}))
    extension = extension_bureautique_document(document)
    url_editeur = construire_url_editeur_collabora_document(wopi_src, jeton, extension)

    return Response(
        {
            "url_editeur": url_editeur,
            "nom_fichier": nom_affichage_document(document),
            "type_bureautique": type_bureautique_document(document),
            "extension": extension,
            "access_token": jeton,
            "access_token_ttl": 8 * 60 * 60 * 1000,
            "fichier": request.build_absolute_uri(document.fichier.url) if document.fichier else None,
        }
    )


@api_view(["GET", "POST"])
@permission_classes([permissions.AllowAny])
def vue_document_wopi_fichier(request, pk):
    document = generics.get_object_or_404(Document, pk=pk)
    contexte = _verifier_acces_wopi_document(request, document)

    if request.method == "GET":
        contenu = lire_contenu_document(document)
        return Response(
            {
                "BaseFileName": nom_affichage_document(document),
                "OwnerId": str(document.pk),
                "Size": len(contenu),
                "Version": str(int(document.date_modification.timestamp())) if document.date_modification else "1",
                "UserId": contexte["utilisateur_id"],
                "UserFriendlyName": getattr(request.user, "get_full_name", lambda: "Utilisateur LBH")() if hasattr(request, "user") else "Utilisateur LBH",
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
    verrou_existant = lire_verrou_document(document)
    verrou_demande = request.headers.get("X-WOPI-Lock", "")

    if override == "LOCK":
        if verrou_existant and verrou_existant != verrou_demande:
            reponse = HttpResponse(status=409)
            reponse["X-WOPI-Lock"] = verrou_existant
            return reponse
        definir_verrou_document(document, verrou_demande)
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
        definir_verrou_document(document, verrou_demande)
        return HttpResponse(status=200)

    if override == "UNLOCK":
        if verrou_existant and verrou_existant != verrou_demande:
            reponse = HttpResponse(status=409)
            reponse["X-WOPI-Lock"] = verrou_existant
            return reponse
        supprimer_verrou_document(document)
        return HttpResponse(status=200)

    return HttpResponse(status=501)


@api_view(["GET", "POST"])
@permission_classes([permissions.AllowAny])
def vue_document_wopi_contenu(request, pk):
    document = generics.get_object_or_404(Document, pk=pk)
    _verifier_acces_wopi_document(request, document)

    if request.method == "GET":
        contenu = lire_contenu_document(document)
        reponse = HttpResponse(contenu, content_type=type_mime_bureautique_document(document))
        reponse["Content-Length"] = str(len(contenu))
        return reponse

    override = (request.headers.get("X-WOPI-Override") or "").upper()
    if override != "PUT":
        return HttpResponse(status=501)

    verrou_existant = lire_verrou_document(document)
    verrou_demande = request.headers.get("X-WOPI-Lock", "")
    if verrou_existant and verrou_existant != verrou_demande:
        reponse = HttpResponse(status=409)
        reponse["X-WOPI-Lock"] = verrou_existant
        return reponse

    enregistrer_contenu_document(document, request.body)
    return HttpResponse(status=200)


class VueDetailDocument(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = DocumentDetailSerialiseur

    def get_queryset(self):
        return Document.objects.select_related(
            "type_document", "projet", "lot", "dossier", "auteur", "valide_par"
        ).prefetch_related("annotations", "diffusions")

    def perform_update(self, serializer):
        document = self.get_object()
        projet = serializer.validated_data.get("projet") or document.projet
        dossier = serializer.validated_data.get("dossier")
        if dossier and dossier.projet_id != projet.id:
            raise ValidationError({"dossier": "Le dossier sélectionné n'appartient pas au projet."})
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        doc = self.get_object()
        if request.user.est_super_admin:
            reference = doc.reference
            doc.delete()
            return Response({"detail": f"Document {reference} supprimé définitivement."})
        doc.statut = "archive"
        doc.est_version_courante = False
        doc.save(update_fields=["statut", "est_version_courante"])
        return Response({"detail": "Document archivé."})


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def vue_valider_document(request, pk):
    """Valide un document et enregistre le valideur."""
    doc = generics.get_object_or_404(Document, pk=pk)
    doc.statut = "valide"
    doc.valide_par = request.user
    doc.date_validation = datetime.now(tz=timezone.utc)
    doc.save(update_fields=["statut", "valide_par", "date_validation"])
    return Response({"detail": "Document validé."})


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def vue_nouvelle_version(request, pk):
    """Crée une nouvelle version d'un document existant."""
    doc_parent = generics.get_object_or_404(Document, pk=pk)

    prochain_indice = chr(ord(doc_parent.version[-1]) + 1) if doc_parent.version else "B"

    Document.objects.filter(
        projet=doc_parent.projet,
        reference=doc_parent.reference,
    ).update(est_version_courante=False)

    nouvelle_version = Document.objects.create(
        reference=doc_parent.reference,
        intitule=doc_parent.intitule,
        type_document=doc_parent.type_document,
        projet=doc_parent.projet,
        lot=doc_parent.lot,
        version=prochain_indice,
        est_version_courante=True,
        document_parent=doc_parent,
        statut="brouillon",
        origine=doc_parent.origine,
        auteur=request.user,
        acces_client=doc_parent.acces_client,
        acces_partenaire=doc_parent.acces_partenaire,
        confidentiel=doc_parent.confidentiel,
    )
    serialiseur = DocumentDetailSerialiseur(
        nouvelle_version, context={"request": request}
    )
    return Response(serialiseur.data, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def vue_lancer_ocr(request, pk):
    """Déclenche l'OCR sur le fichier d'un document et met à jour contenu_texte + mots_cles."""
    doc = generics.get_object_or_404(Document, pk=pk)

    if not doc.fichier:
        return Response({"detail": "Ce document n'a pas de fichier joint."}, status=status.HTTP_400_BAD_REQUEST)

    types_ocr = {"application/pdf", "image/png", "image/jpeg", "image/tiff", "image/bmp", "image/webp"}
    if doc.type_mime and doc.type_mime not in types_ocr:
        return Response({"detail": f"Type de fichier non supporté par l'OCR : {doc.type_mime}"}, status=status.HTTP_400_BAD_REQUEST)

    ocr_hote = os.getenv("OCR_HOTE", f"{_prefixe_plateforme()}-ocr")
    ocr_port = os.getenv("OCR_PORT", "8010")
    url_ocr = f"http://{ocr_hote}:{ocr_port}/ocr/extraire"

    try:
        with doc.fichier.open("rb") as f:
            contenu = f.read()

        nom_fichier = doc.nom_fichier_origine or "document"
        mime = doc.type_mime or "application/octet-stream"

        delimiteur, corps = _construire_corps_multipart(
            nom_champ="fichier",
            nom_fichier=nom_fichier,
            contenu=contenu,
            type_mime=mime,
        )
        requete = urllib_request.Request(
            url_ocr,
            data=corps,
            method="POST",
            headers={
                "Content-Type": f"multipart/form-data; boundary={delimiteur}",
                "Content-Length": str(len(corps)),
            },
        )
        with urllib_request.urlopen(requete, timeout=120) as reponse:
            resultat = json.loads(reponse.read().decode("utf-8"))

        texte = resultat.get("texte", "")
        # Extraction mots-clés simples : mots uniques de plus de 4 lettres
        mots = list({m.lower() for m in texte.split() if len(m) > 4 and m.isalpha()})[:50]

        doc.ocr_effectue = True
        doc.contenu_texte = texte
        doc.mots_cles = mots
        doc.save(update_fields=["ocr_effectue", "contenu_texte", "mots_cles"])

        journal.info("OCR terminé — document %s, %d caractères extraits", doc.reference, len(texte))
        return Response({
            "detail": "OCR effectué avec succès.",
            "pages": resultat.get("pages", 0),
            "confiance": resultat.get("confiance", 0),
            "caracteres": len(texte),
        })

    except urllib_error.HTTPError as e:
        journal.error("Erreur HTTP OCR : %s", str(e))
        return Response({"detail": f"Erreur du service OCR : {e.code}"}, status=status.HTTP_502_BAD_GATEWAY)
    except urllib_error.URLError as e:
        journal.error("Service OCR inaccessible : %s", str(e))
        return Response({"detail": "Service OCR inaccessible."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def vue_lancer_analyse_document(request, pk):
    """Relance l'analyse documentaire automatique et la classification."""
    doc = generics.get_object_or_404(Document, pk=pk)
    try:
        analyse = analyser_document_automatiquement(doc, forcer=True)
        return Response({
            "detail": "Analyse documentaire terminée.",
            "analyse": analyse,
        })
    except ErreurServiceAnalyse as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def vue_importer_document_bibliotheque(request, pk):
    """Projette un document économique dans la bibliothèque de prix."""
    doc = generics.get_object_or_404(
        Document.objects.select_related("type_document", "projet__organisation"),
        pk=pk,
    )
    limite = request.data.get("limite")
    limite_normalisee = int(limite) if limite not in (None, "") else None
    statut_validation = request.data.get("statut_validation") or "a_valider"

    try:
        resultat = importer_document_economique_dans_bibliotheque(
            doc,
            auteur=request.user,
            limite=limite_normalisee,
            statut_validation=statut_validation,
        )
    except RuntimeError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    except ErreurServiceAnalyse as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    return Response(
        {
            "detail": "Document importé dans la bibliothèque.",
            **resultat,
        },
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def vue_appliquer_suggestions_document(request, pk):
    """Applique les suggestions de reclassement si elles sont disponibles."""
    doc = generics.get_object_or_404(Document, pk=pk)
    changements = appliquer_suggestions_document(doc)
    if not changements:
        return Response({"detail": "Aucune suggestion applicable."}, status=status.HTTP_200_OK)
    return Response({"detail": "Suggestions appliquées.", "changements": changements})


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def vue_appliquer_suggestions_documents(request):
    """Applique les suggestions sur une sélection de documents."""
    ids = request.data.get("ids") or []
    if not isinstance(ids, list) or not ids:
        return Response({"detail": "Aucun document sélectionné."}, status=status.HTTP_400_BAD_REQUEST)

    documents = list(Document.objects.filter(pk__in=ids).select_related("type_document", "projet"))
    total = len(documents)
    appliques = 0
    details: list[dict[str, object]] = []

    for document in documents:
        changements = appliquer_suggestions_document(document)
        if changements:
            appliques += 1
            details.append({
                "id": str(document.id),
                "reference": document.reference,
                "changements": changements,
            })

    return Response(
        {
            "detail": f"{appliques} document(s) reclassé(s) sur {total}.",
            "total": total,
            "appliques": appliques,
            "details": details,
        }
    )


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def vue_importer_archive_documents(request):
    """Importe une archive ZIP et crée automatiquement les documents qu'elle contient."""
    fichier = request.FILES.get("fichier")
    if not fichier:
        return Response({"detail": "Aucune archive fournie."}, status=status.HTTP_400_BAD_REQUEST)

    projet = None
    projet_id = request.data.get("projet")
    if projet_id:
        from applications.projets.models import Projet

        projet = generics.get_object_or_404(Projet, pk=projet_id)

    try:
        resultat = importer_archive_documents(
            contenu_archive=fichier.read(),
            nom_archive=fichier.name,
            utilisateur=request.user,
            projet_defaut=projet,
        )
        return Response({"detail": "Archive importée.", **resultat}, status=status.HTTP_201_CREATED)
    except ErreurServiceAnalyse as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def vue_previsualiser_suggestions_documents(request):
    """Prévisualise les changements avant application en masse."""
    ids = request.data.get("ids") or []
    if not isinstance(ids, list) or not ids:
        return Response({"detail": "Aucun document sélectionné."}, status=status.HTTP_400_BAD_REQUEST)

    documents = list(Document.objects.filter(pk__in=ids).select_related("type_document", "projet"))
    details = [previsualiser_suggestions_document(document) for document in documents]
    applicables = [detail for detail in details if detail["changements"]]

    return Response(
        {
            "total": len(details),
            "applicables": len(applicables),
            "details": details,
        }
    )


class VueAnnotationsDocument(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = AnnotationDocumentSerialiseur

    def get_queryset(self):
        return AnnotationDocument.objects.filter(
            document_id=self.kwargs["doc_id"]
        ).select_related("auteur")

    def perform_create(self, serializer):
        doc = generics.get_object_or_404(Document, pk=self.kwargs["doc_id"])
        serializer.save(auteur=self.request.user, document=doc)


class VueDiffusionsDocument(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = DiffusionDocumentSerialiseur

    def get_queryset(self):
        return DiffusionDocument.objects.filter(
            document_id=self.kwargs["doc_id"]
        ).select_related("destinataire")

    def perform_create(self, serializer):
        doc = generics.get_object_or_404(Document, pk=self.kwargs["doc_id"])
        serializer.save(document=doc)
