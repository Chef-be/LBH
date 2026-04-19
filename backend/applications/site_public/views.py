"""Vues API pour le site vitrine public — Plateforme LBH."""

import html
import logging
import mimetypes

from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, parser_classes, permission_classes, throttle_classes
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.conf import settings

from .models import (
    Prestation, Realisation, MembreEquipe, DemandeContact,
    ConfigurationSite, StatistiqueSite, ValeurSite, EtapeDemarche,
    ConfigurationRGPD, PageStatique, Actualite,
)
from .serialiseurs import (
    PrestationSerialiseur, PrestationResumeSerialiseur,
    RealisationSerialiseur, RealisationResumeSerialiseur,
    MembreEquipeSerialiseur, DemandeContactSerialiseur,
    ConfigurationSiteSerialiseur, StatistiqueSiteSerialiseur,
    ValeurSiteSerialiseur, EtapeDemarcheSerialiseur,
    ConfigurationRGPDSerialiseur, PageStatiqueSerialiseur,
    ActualiteSerialiseur, ActualiteResumeSerialiseur,
)
from applications.messagerie.services import MessagerieErreur, envoyer_courriel, obtenir_configuration_smtp
from applications.messagerie.utils import obtenir_nom_plateforme


logger = logging.getLogger(__name__)


class PermissionPublicOuAdmin(permissions.BasePermission):
    """Lecture publique, écriture réservée aux utilisateurs connectés."""
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user and request.user.is_authenticated


# ---------------------------------------------------------------------------
# Point d'entrée agrégé — page d'accueil
# ---------------------------------------------------------------------------

@api_view(["GET"])
@throttle_classes([])
@permission_classes([permissions.AllowAny])
def vue_accueil(request):
    """
    Retourne toutes les données dynamiques de la page d'accueil en un seul appel.
    Accès public, aucune authentification requise.
    """
    config = ConfigurationSite.obtenir()
    prestations = Prestation.objects.filter(est_publie=True)
    statistiques = StatistiqueSite.objects.filter(est_publie=True)
    valeurs = ValeurSite.objects.filter(est_publiee=True)
    demarche = EtapeDemarche.objects.filter(est_publiee=True)

    realisations_qs = Realisation.objects.filter(est_publie=True)[:6]

    donnees = {
        "configuration": ConfigurationSiteSerialiseur(config).data,
        "prestations": PrestationResumeSerialiseur(prestations, many=True).data,
        "statistiques": StatistiqueSiteSerialiseur(statistiques, many=True).data,
        "valeurs": ValeurSiteSerialiseur(valeurs, many=True).data,
        "demarche": EtapeDemarcheSerialiseur(demarche, many=True).data,
        "realisations": RealisationResumeSerialiseur(realisations_qs, many=True).data,
    }
    return Response(donnees)


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

@api_view(["GET", "PATCH"])
@throttle_classes([])
@parser_classes([MultiPartParser, FormParser, JSONParser])
@permission_classes([permissions.AllowAny])
def vue_configuration(request):
    """Lit ou modifie la configuration du site (GET public, PATCH admin)."""
    config = ConfigurationSite.obtenir()
    if request.method == "GET":
        return Response(ConfigurationSiteSerialiseur(config).data)

    if not (request.user and request.user.is_authenticated and request.user.est_super_admin):
        return Response({"detail": "Non autorisé."}, status=status.HTTP_403_FORBIDDEN)

    serialiseur = ConfigurationSiteSerialiseur(config, data=request.data, partial=True)
    if serialiseur.is_valid():
        serialiseur.save(modifie_par=request.user)
        return Response(serialiseur.data)
    return Response(serialiseur.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET", "PATCH"])
@throttle_classes([])
@parser_classes([MultiPartParser, FormParser, JSONParser])
@permission_classes([permissions.AllowAny])
def vue_configuration_rgpd(request):
    """Lit ou modifie la configuration RGPD (GET public, PATCH admin)."""
    config = ConfigurationRGPD.obtenir()
    if request.method == "GET":
        return Response(ConfigurationRGPDSerialiseur(config).data)

    if not (request.user and request.user.is_authenticated and request.user.est_super_admin):
        return Response({"detail": "Non autorisé."}, status=status.HTTP_403_FORBIDDEN)

    serialiseur = ConfigurationRGPDSerialiseur(config, data=request.data, partial=True)
    if serialiseur.is_valid():
        serialiseur.save(modifie_par=request.user)
        return Response(serialiseur.data)
    return Response(serialiseur.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["POST"])
@parser_classes([MultiPartParser, FormParser, JSONParser])
@permission_classes([permissions.IsAuthenticated])
def vue_televerser_media_site(request):
    """Téléverse un média du site public, notamment pour le carrousel."""
    if not request.user.est_super_admin:
        return Response({"detail": "Non autorisé."}, status=status.HTTP_403_FORBIDDEN)

    fichier = request.FILES.get("fichier")
    if not fichier:
        return Response({"detail": "Aucun fichier reçu."}, status=status.HTTP_400_BAD_REQUEST)

    if not (fichier.content_type or "").startswith("image/"):
        return Response(
            {"detail": "Seules les images sont acceptées pour ce téléversement."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    usage = request.data.get("usage") or "divers"
    sous_repertoire = "carrousel" if usage == "carrousel" else "divers"
    url = ConfigurationSite.televerser_media_site(fichier, sous_repertoire=sous_repertoire)
    return Response({"url": request.build_absolute_uri(url), "chemin": url})


# ---------------------------------------------------------------------------
# Proxy médias — logo, favicon (retournent les fichiers depuis le stockage objet)
# Ces endpoints permettent au navigateur d'accéder aux fichiers sans passer
# par l'URL interne MinIO (lbh-minio:9000) non joignable publiquement.
# ---------------------------------------------------------------------------

def _servir_champ_image(champ, etiquette_cache="logo"):
    """Lit un champ ImageField depuis le stockage et retourne une HttpResponse."""
    if not champ:
        return HttpResponse(status=404)
    try:
        with champ.open("rb") as fichier:
            contenu = fichier.read()
        type_contenu = mimetypes.guess_type(champ.name)[0] or "application/octet-stream"
        reponse = HttpResponse(contenu, content_type=type_contenu)
        reponse["Cache-Control"] = "public, max-age=3600"
        return reponse
    except Exception:
        return HttpResponse(status=404)


@api_view(["GET"])
@throttle_classes([])
@permission_classes([permissions.AllowAny])
def vue_logo(request):
    """Sert le logo principal du site depuis le stockage objet."""
    config = ConfigurationSite.obtenir()
    return _servir_champ_image(config.logo if config else None)


@api_view(["GET"])
@throttle_classes([])
@permission_classes([permissions.AllowAny])
def vue_logo_pied_de_page(request):
    """Sert le logo pied de page (fallback sur logo principal)."""
    config = ConfigurationSite.obtenir()
    if config:
        champ = config.logo_pied_de_page or config.logo
        return _servir_champ_image(champ)
    return HttpResponse(status=404)


@api_view(["GET"])
@throttle_classes([])
@permission_classes([permissions.AllowAny])
def vue_favicon(request):
    """Sert le favicon depuis le stockage objet."""
    config = ConfigurationSite.obtenir()
    if config and config.favicon:
        reponse = _servir_champ_image(config.favicon)
        if reponse.status_code != 404:
            return reponse

    libelle = (config.sigle or config.nom_bureau or "LBH") if config else "LBH"
    texte = html.escape((libelle.strip() or "LBH")[:3].upper())
    contenu = f"""
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="{texte}">
      <rect width="64" height="64" rx="14" fill="#0f172a" />
      <rect x="6" y="6" width="52" height="52" rx="10" fill="#1d4ed8" />
      <text x="32" y="40" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" font-weight="700" fill="#ffffff">{texte}</text>
    </svg>
    """.strip().encode("utf-8")
    reponse = HttpResponse(contenu, content_type="image/svg+xml")
    reponse["Cache-Control"] = "public, max-age=3600"
    return reponse


# ---------------------------------------------------------------------------
# Statistiques
# ---------------------------------------------------------------------------

class VueListeStatistiques(generics.ListCreateAPIView):
    serializer_class = StatistiqueSiteSerialiseur

    def get_permissions(self):
        if self.request.method == "GET":
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        qs = StatistiqueSite.objects.all()
        if not (self.request.user and self.request.user.is_authenticated):
            qs = qs.filter(est_publie=True)
        return qs

    def perform_create(self, serialiseur):
        if not self.request.user.est_super_admin:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied()
        serialiseur.save()


class VueDetailStatistique(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = StatistiqueSiteSerialiseur
    queryset = StatistiqueSite.objects.all()


# ---------------------------------------------------------------------------
# Valeurs / avantages
# ---------------------------------------------------------------------------

class VueListeValeurs(generics.ListCreateAPIView):
    serializer_class = ValeurSiteSerialiseur

    def get_permissions(self):
        if self.request.method == "GET":
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        qs = ValeurSite.objects.all()
        if not (self.request.user and self.request.user.is_authenticated):
            qs = qs.filter(est_publiee=True)
        return qs


class VueDetailValeur(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ValeurSiteSerialiseur
    queryset = ValeurSite.objects.all()


# ---------------------------------------------------------------------------
# Démarche
# ---------------------------------------------------------------------------

class VueListeDemarche(generics.ListCreateAPIView):
    serializer_class = EtapeDemarcheSerialiseur

    def get_permissions(self):
        if self.request.method == "GET":
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        qs = EtapeDemarche.objects.all()
        if not (self.request.user and self.request.user.is_authenticated):
            qs = qs.filter(est_publiee=True)
        return qs


class VueDetailEtapeDemarche(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = EtapeDemarcheSerialiseur
    queryset = EtapeDemarche.objects.all()


# ---------------------------------------------------------------------------
# Pages statiques
# ---------------------------------------------------------------------------

class VueListePagesStatiques(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = PageStatiqueSerialiseur

    def get_queryset(self):
        return PageStatique.objects.filter(est_publiee=True, afficher_dans_pied_de_page=True)


class VueAdminPagesStatiques(generics.ListCreateAPIView):
    """Admin — liste et création de pages statiques."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = PageStatiqueSerialiseur

    def get_queryset(self):
        return PageStatique.objects.all()

    def perform_create(self, serialiseur):
        serialiseur.save(modifie_par=self.request.user)


class VueAdminDetailPageStatique(generics.RetrieveUpdateDestroyAPIView):
    """Admin — détail, modification et suppression d'une page statique."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = PageStatiqueSerialiseur
    queryset = PageStatique.objects.all()

    def perform_update(self, serialiseur):
        serialiseur.save(modifie_par=self.request.user)


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def vue_page_statique(request, code):
    """Retourne une page statique par son code slug."""
    page = get_object_or_404(PageStatique, code=code, est_publiee=True)
    return Response(PageStatiqueSerialiseur(page).data)


# ---------------------------------------------------------------------------
# Prestations
# ---------------------------------------------------------------------------

class VueListePrestations(generics.ListCreateAPIView):
    permission_classes = [PermissionPublicOuAdmin]
    serializer_class = PrestationSerialiseur

    def get_queryset(self):
        qs = Prestation.objects.all()
        if not (self.request.user and self.request.user.is_authenticated):
            qs = qs.filter(est_publie=True)
        return qs

    def perform_create(self, serialiseur):
        if not self.request.user.est_super_admin:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied()
        serialiseur.save()


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def vue_prestation_par_slug(request, slug):
    """Retourne une prestation par son slug — accès public."""
    prestation = get_object_or_404(Prestation, slug=slug, est_publie=True)
    return Response(PrestationSerialiseur(prestation).data)


class VueDetailPrestation(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = PrestationSerialiseur
    queryset = Prestation.objects.all()


# ---------------------------------------------------------------------------
# Réalisations
# ---------------------------------------------------------------------------

class VueListeRealisations(generics.ListCreateAPIView):
    permission_classes = [PermissionPublicOuAdmin]
    serializer_class = RealisationSerialiseur

    def get_queryset(self):
        qs = Realisation.objects.all()
        if not (self.request.user and self.request.user.is_authenticated):
            qs = qs.filter(est_publie=True)
        return qs

    def perform_create(self, serialiseur):
        if not self.request.user.est_super_admin:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied()
        serialiseur.save()


class VueDetailRealisation(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = RealisationSerialiseur
    queryset = Realisation.objects.all()

    def get_permissions(self):
        if self.request.method == "GET":
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        qs = Realisation.objects.all()
        if not (self.request.user and self.request.user.is_authenticated):
            qs = qs.filter(est_publie=True)
        return qs


# ---------------------------------------------------------------------------
# Équipe
# ---------------------------------------------------------------------------

class VueListeEquipe(generics.ListAPIView):
    permission_classes = [PermissionPublicOuAdmin]
    serializer_class = MembreEquipeSerialiseur

    def get_queryset(self):
        qs = MembreEquipe.objects.all()
        if not (self.request.user and self.request.user.is_authenticated):
            qs = qs.filter(est_publie=True)
        return qs


class VueDetailMembreEquipe(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = MembreEquipeSerialiseur
    queryset = MembreEquipe.objects.all()


# ---------------------------------------------------------------------------
# Actualités
# ---------------------------------------------------------------------------

class VueListeActualites(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = ActualiteResumeSerialiseur

    def get_queryset(self):
        return Actualite.objects.filter(etat="publie")


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def vue_actualite_par_slug(request, slug):
    """Retourne une actualité par son slug — accès public."""
    actualite = get_object_or_404(Actualite, slug=slug, etat="publie")
    return Response(ActualiteSerialiseur(actualite).data)


# ---------------------------------------------------------------------------
# Contact
# ---------------------------------------------------------------------------

@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def vue_soumettre_contact(request):
    """Reçoit une demande de contact du site vitrine (accès public)."""
    serialiseur = DemandeContactSerialiseur(data=request.data)
    if serialiseur.is_valid():
        x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
        ip = x_forwarded_for.split(",")[0].strip() if x_forwarded_for else request.META.get("REMOTE_ADDR")
        demande = serialiseur.save(adresse_ip=ip)
        config_site = ConfigurationSite.obtenir()
        nom_plateforme = obtenir_nom_plateforme()
        destinataires_notification = [
            adresse
            for adresse in [config_site.courriel_contact, getattr(settings, "SERVER_EMAIL", "")]
            if adresse
        ]

        if destinataires_notification:
            try:
                configuration_smtp = obtenir_configuration_smtp(usage="notifications")
                envoyer_courriel(
                    sujet=f"Nouvelle demande de contact - {demande.nom}",
                    destinataires=destinataires_notification,
                    corps_texte=(
                        "Une nouvelle demande de contact a été reçue via le site vitrine.\n\n"
                        f"Nom : {demande.nom}\n"
                        f"Courriel : {demande.courriel}\n"
                        f"Téléphone : {demande.telephone}\n"
                        f"Organisation : {demande.organisation}\n"
                        f"Sujet : {demande.sujet}\n\n"
                        f"Message :\n{demande.message}\n"
                    ),
                    reponse_a=[demande.courriel],
                    configuration=configuration_smtp,
                    origine="contact",
                    contexte_journal={"demande_contact_id": str(demande.pk)},
                )
                envoyer_courriel(
                    sujet=f"Votre demande a bien été prise en compte par {nom_plateforme}",
                    destinataires=[demande.courriel],
                    corps_texte=(
                        f"Bonjour {demande.nom},\n\n"
                        f"Votre demande a bien été reçue par {nom_plateforme}. "
                        "Nous reviendrons vers vous dans les meilleurs délais.\n\n"
                        f"Cordialement,\n{nom_plateforme}"
                    ),
                    configuration=configuration_smtp,
                    origine="contact",
                    contexte_journal={"demande_contact_id": str(demande.pk), "type": "accuse_reception"},
                )
            except MessagerieErreur:
                logger.exception("Impossible d'envoyer les courriels liés à la demande de contact %s", demande.pk)
        return Response(
            {"detail": "Votre demande a bien été transmise. Nous vous répondrons rapidement."},
            status=status.HTTP_201_CREATED,
        )
    return Response(serialiseur.errors, status=status.HTTP_400_BAD_REQUEST)


class VueListeDemandesContact(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = DemandeContactSerialiseur
    ordering = ["-date_reception"]

    def get_queryset(self):
        if not self.request.user.est_super_admin:
            return DemandeContact.objects.none()
        qs = DemandeContact.objects.all()
        traitee = self.request.query_params.get("traitee")
        if traitee == "0":
            qs = qs.filter(traitee=False)
        elif traitee == "1":
            qs = qs.filter(traitee=True)
        return qs


@api_view(["PATCH"])
@permission_classes([permissions.IsAuthenticated])
def vue_marquer_contact_traite(request, pk):
    demande = get_object_or_404(DemandeContact, pk=pk)
    demande.traitee = True
    demande.save(update_fields=["traitee"])
    return Response({"detail": "Demande marquée comme traitée."})
