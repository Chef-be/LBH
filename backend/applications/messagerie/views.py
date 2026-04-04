"""Vues API pour la messagerie, le journal d'envoi et la configuration Roundcube."""

from __future__ import annotations

import html
import mimetypes
from urllib.parse import urljoin

from rest_framework import generics, permissions
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.response import Response
from django.conf import settings
from django.http import FileResponse, HttpResponse, HttpResponseRedirect
from django.urls import reverse

from applications.parametres.models import Parametre
from applications.site_public.models import ConfigurationSite
from applications.supervision.models import ServeurMail

from .models import JournalCourriel
from .serialiseurs import JournalCourrielSerialiseur, ServeurMessagerieSerialiseur
from .services import obtenir_configuration_imap, obtenir_configuration_smtp
from .utils import obtenir_nom_plateforme


class EstSuperAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return request.user and request.user.is_authenticated
        return request.user and request.user.is_authenticated and request.user.est_super_admin


class EstSuperAdminStrict(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.est_super_admin


class VueListeJournalCourriels(generics.ListAPIView):
    permission_classes = [EstSuperAdminStrict]
    serializer_class = JournalCourrielSerialiseur

    def get_queryset(self):
        queryset = JournalCourriel.objects.select_related("utilisateur")
        origine = self.request.query_params.get("origine")
        statut_courriel = self.request.query_params.get("statut")
        if origine:
            queryset = queryset.filter(origine=origine)
        if statut_courriel:
            queryset = queryset.filter(statut=statut_courriel)
        return queryset


def _appliquer_serveur_mail_defaut(instance: ServeurMail):
    if not instance.est_actif and instance.est_defaut:
        instance.est_defaut = False
        instance.save(update_fields=["est_defaut"])

    if instance.est_defaut:
        ServeurMail.objects.exclude(pk=instance.pk).update(est_defaut=False)
        return

    if not ServeurMail.objects.exclude(pk=instance.pk).filter(est_defaut=True).exists() and instance.est_actif:
        instance.est_defaut = True
        instance.save(update_fields=["est_defaut"])
        return

    if not ServeurMail.objects.filter(est_defaut=True).exists():
        suivant = ServeurMail.objects.filter(est_actif=True).order_by("nom").first()
        if suivant:
            suivant.est_defaut = True
            suivant.save(update_fields=["est_defaut"])


def _valeur_parametre(cle: str, secours: str = "") -> str:
    parametre = Parametre.objects.filter(cle=cle).first()
    if not parametre:
        return secours
    valeur = parametre.valeur_typee()
    if valeur is None:
        return secours
    texte = str(valeur).strip()
    return texte or secours


def _hote_roundcube(hote: str, port: int, chiffrement: str) -> str:
    if not hote:
        return ""
    prefixe = "ssl://" if chiffrement == "ssl_tls" else "tls://" if chiffrement == "starttls" else ""
    return f"{prefixe}{hote}:{int(port)}"


def _absolutiser_url_publique(url: str) -> str:
    if not url:
        return ""
    if url.startswith(("http://", "https://")):
        return url

    url_base = (getattr(settings, "URL_BASE", "") or "").strip()
    if not url_base:
        return url

    return urljoin(f"{url_base.rstrip('/')}/", url.lstrip("/"))


def _reponse_sans_cache(reponse):
    reponse["Cache-Control"] = "no-store, no-cache, max-age=0, must-revalidate"
    reponse["Pragma"] = "no-cache"
    reponse["Expires"] = "0"
    return reponse


def _url_logo_roundcube() -> str:
    return _absolutiser_url_publique(reverse("roundcube-logo"))


def _url_watermark_roundcube() -> str:
    return _absolutiser_url_publique(reverse("roundcube-watermark"))


def _url_logo_roundcube_secours() -> str:
    return _absolutiser_url_publique("/roundcube/skins/elastic/images/logo.svg")


class VueListeServeursMessagerie(generics.ListCreateAPIView):
    permission_classes = [EstSuperAdmin]
    serializer_class = ServeurMessagerieSerialiseur
    queryset = ServeurMail.objects.select_related("modifie_par").order_by("-est_defaut", "nom")

    def perform_create(self, serializer):
        instance = serializer.save(modifie_par=self.request.user)
        _appliquer_serveur_mail_defaut(instance)


class VueDetailServeurMessagerie(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [EstSuperAdmin]
    serializer_class = ServeurMessagerieSerialiseur
    queryset = ServeurMail.objects.select_related("modifie_par")

    def perform_update(self, serializer):
        instance = serializer.save(modifie_par=self.request.user)
        _appliquer_serveur_mail_defaut(instance)

    def perform_destroy(self, instance):
        etait_defaut = instance.est_defaut
        instance.delete()
        if etait_defaut:
            suivant = ServeurMail.objects.filter(est_actif=True).order_by("nom").first()
            if suivant:
                suivant.est_defaut = True
                suivant.save(update_fields=["est_defaut"])


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
@throttle_classes([])
def vue_configuration_roundcube(request):
    configuration_site = ConfigurationSite.obtenir()
    configuration_smtp = obtenir_configuration_smtp(usage="plateforme")
    configuration_imap = obtenir_configuration_imap()
    nom_plateforme = (configuration_site.nom_bureau or "").strip() or obtenir_nom_plateforme()
    produit_defaut = f"Messagerie {nom_plateforme}".strip() if nom_plateforme else "Messagerie"
    logo = _url_logo_roundcube() if configuration_site.logo else ""
    logo_link = _absolutiser_url_publique(_valeur_parametre("ROUNDCUBE_LOGO_LIEN", "/roundcube/?_task=mail"))

    return _reponse_sans_cache(
        Response(
        {
            "product_name": _valeur_parametre("ROUNDCUBE_NOM_APPLICATION", produit_defaut),
            "language": _valeur_parametre("ROUNDCUBE_LANGUE", "fr_FR"),
            "default_task": _valeur_parametre("ROUNDCUBE_TACHE_DEFAUT", "mail"),
            "support_url": _valeur_parametre("ROUNDCUBE_URL_AIDE", ""),
            "logo_url": logo,
            "logo_link": logo_link,
            "blankpage_url": _url_watermark_roundcube(),
            "bureau_nom": nom_plateforme,
            "imap_host": _hote_roundcube(
                configuration_imap.hote,
                configuration_imap.port,
                configuration_imap.chiffrement,
            ),
            "smtp_host": _hote_roundcube(
                configuration_smtp.hote,
                configuration_smtp.port,
                configuration_smtp.chiffrement,
            ),
            "sent_mbox": configuration_imap.dossier_envoyes,
            "drafts_mbox": configuration_imap.dossier_brouillons,
            "archive_mbox": configuration_imap.dossier_archives,
            "junk_mbox": configuration_imap.dossier_indesirables,
            "trash_mbox": configuration_imap.dossier_corbeille,
        }
        )
    )


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
@throttle_classes([])
def vue_logo_roundcube(request):
    configuration_site = ConfigurationSite.obtenir()

    if configuration_site.logo:
        try:
            fichier = configuration_site.logo.open("rb")
        except FileNotFoundError:
            fichier = None

        if fichier is not None:
            type_contenu = mimetypes.guess_type(configuration_site.logo.name)[0] or "application/octet-stream"
            return _reponse_sans_cache(FileResponse(fichier, content_type=type_contenu))

    return _reponse_sans_cache(HttpResponseRedirect(_url_logo_roundcube_secours()))


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
@throttle_classes([])
def vue_watermark_roundcube(request):
    configuration_site = ConfigurationSite.obtenir()
    logo_url = _url_logo_roundcube() if configuration_site.logo else _url_logo_roundcube_secours()
    html_reponse = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title></title>
<style type="text/css">
html, body {{ height: 100%; overflow: hidden; }}
body {{
  background: center no-repeat #fff;
  background-image: url("{html.escape(logo_url, quote=True)}");
  background-size: min(30%, 320px);
  background-blend-mode: luminosity;
}}
html:not(.dark-mode) body:before {{
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(255, 255, 255, .85);
}}
html.dark-mode > body {{
  background-color: #21292c;
  background-blend-mode: soft-light;
}}
</style>
<script>
  try {{
    if (document.cookie.indexOf('colorMode=dark') > -1
      || (document.cookie.indexOf('colorMode=light') === -1 && window.matchMedia('(prefers-color-scheme: dark)').matches)
    ) {{
      document.documentElement.className += ' dark-mode';
    }}
  }} catch (e) {{ }}
</script>
</head>
<body></body>
</html>
"""
    return _reponse_sans_cache(HttpResponse(html_reponse, content_type="text/html; charset=utf-8"))
