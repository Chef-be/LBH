"""Vues API pour la supervision — Plateforme LBH."""

from datetime import datetime, timezone as timezone_python

from django.db.models import OuterRef, Subquery
from django.utils import timezone
from rest_framework import filters, generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from .models import (
    AlerteSupervision,
    EvenementSysteme,
    InstantaneServeur,
    MetriqueService,
    ServeurMail,
)
from .serialiseurs import (
    AlerteSupervisionSerialiseur,
    EvenementSystemeSerialiseur,
    InstantaneServeurSerialiseur,
    MetriqueServiceSerialiseur,
    ServeurMailSerialiseur,
)
from .services import (
    DockerUnavailableError,
    capturer_metriques_serveur,
    enregistrer_instantane_serveur_si_necessaire,
    lister_conteneurs_docker,
    synthese_services,
    tester_configuration_smtp,
)


class EstSuperAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.est_super_admin


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


def _payload_tableau_bord_supervision() -> dict:
    snapshot = capturer_metriques_serveur()
    instantane = enregistrer_instantane_serveur_si_necessaire(snapshot)
    historique = list(
        InstantaneServeur.objects.order_by("-horodatage")[:24]
    )
    historique.reverse()

    docker_disponible = True
    docker_erreur = None
    conteneurs = []
    services = []
    try:
        conteneurs = lister_conteneurs_docker()
        services = synthese_services(conteneurs)
    except (DockerUnavailableError, Exception) as exc:
        docker_disponible = False
        docker_erreur = str(exc)

    alertes_actives_qs = AlerteSupervision.objects.filter(est_active=True)
    alertes_qs = alertes_actives_qs.order_by("-date_declenchement")[:10]

    alertes_actives = alertes_actives_qs.count()
    alertes_critiques = alertes_actives_qs.filter(niveau="critique").count()
    erreurs_non_resolues = EvenementSysteme.objects.filter(
        niveau__in=["erreur", "critique"],
        resolu=False,
    ).count()
    services_indisponibles = [service["nom"] for service in services if service["statut"] == "ko"]
    services_ko = len(services_indisponibles)

    etat_global = "nominal"
    if alertes_critiques or services_ko:
        etat_global = "critique"
    elif alertes_actives or erreurs_non_resolues or any(service["statut"] == "alerte" for service in services):
        etat_global = "avertissement"

    return {
        "horodatage": timezone.now().isoformat(),
        "alertes_actives": alertes_actives,
        "alertes_critiques": alertes_critiques,
        "erreurs_non_resolues": erreurs_non_resolues,
        "services_ko": services_ko,
        "services_indisponibles": services_indisponibles,
        "etat_global": etat_global,
        "serveur": InstantaneServeurSerialiseur(instantane).data,
        "historique_serveur": InstantaneServeurSerialiseur(historique, many=True).data,
        "services": services,
        "conteneurs": conteneurs,
        "alertes": AlerteSupervisionSerialiseur(alertes_qs, many=True).data,
        "meta": {
            "docker_disponible": docker_disponible,
            "docker_erreur": docker_erreur,
            "source_metriques": snapshot.get("details", {}).get("source"),
        },
    }


class VueListeEvenements(generics.ListAPIView):
    """Journal des événements système (lecture seule, super-admin uniquement)."""

    permission_classes = [EstSuperAdmin]
    serializer_class = EvenementSystemeSerialiseur
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["message", "source", "categorie"]
    ordering = ["-date_evenement"]

    def get_queryset(self):
        qs = EvenementSysteme.objects.select_related("utilisateur")
        niveau = self.request.query_params.get("niveau")
        if niveau:
            qs = qs.filter(niveau=niveau)
        categorie = self.request.query_params.get("categorie")
        if categorie:
            qs = qs.filter(categorie=categorie)
        non_resolus = self.request.query_params.get("non_resolus")
        if non_resolus == "1":
            qs = qs.filter(resolu=False)
        return qs


class VueListeMetriques(generics.ListAPIView):
    """Métriques de services (dernière valeur par service)."""

    permission_classes = [EstSuperAdmin]
    serializer_class = MetriqueServiceSerialiseur

    def get_queryset(self):
        derniers = MetriqueService.objects.filter(service=OuterRef("service")).order_by("-horodatage").values("id")[:1]
        return MetriqueService.objects.filter(id__in=Subquery(derniers)).order_by("service")


class VueListeAlertes(generics.ListAPIView):
    """Liste des alertes de supervision."""

    permission_classes = [EstSuperAdmin]
    serializer_class = AlerteSupervisionSerialiseur
    ordering = ["-date_declenchement"]

    def get_queryset(self):
        qs = AlerteSupervision.objects.select_related("acquittee_par")
        actives = self.request.query_params.get("actives")
        if actives == "1":
            qs = qs.filter(est_active=True)
        elif actives == "0":
            qs = qs.filter(est_active=False)
        return qs


class VueListeServeursMail(generics.ListCreateAPIView):
    """Liste et création des serveurs de messagerie sortante."""

    permission_classes = [EstSuperAdmin]
    serializer_class = ServeurMailSerialiseur
    queryset = ServeurMail.objects.select_related("modifie_par").order_by("-est_defaut", "nom")

    def perform_create(self, serializer):
        instance = serializer.save(modifie_par=self.request.user)
        _appliquer_serveur_mail_defaut(instance)


class VueDetailServeurMail(generics.RetrieveUpdateDestroyAPIView):
    """Consultation, modification et suppression d'un serveur de mail."""

    permission_classes = [EstSuperAdmin]
    serializer_class = ServeurMailSerialiseur
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


@api_view(["POST"])
@permission_classes([EstSuperAdmin])
def vue_tester_serveur_mail(request, pk):
    """Teste une connexion SMTP à partir d'une configuration enregistrée."""

    serveur = generics.get_object_or_404(ServeurMail, pk=pk)
    configuration = {
        "hote": serveur.hote,
        "port": serveur.port,
        "chiffrement": serveur.chiffrement,
        "utilisateur": serveur.utilisateur,
        "mot_de_passe": serveur.mot_de_passe,
        "expediteur_defaut": serveur.expediteur_defaut,
        "delai_connexion": serveur.delai_connexion,
        "verifier_certificat": serveur.verifier_certificat,
    }
    try:
        resultat = tester_configuration_smtp(configuration)
    except Exception as exc:
        return Response(
            {"detail": f"Échec du test SMTP : {exc}"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    return Response(
        {
            "detail": resultat.detail,
            "latence_ms": resultat.latence_ms,
            "succes": resultat.succes,
        }
    )


@api_view(["POST"])
@permission_classes([EstSuperAdmin])
def vue_acquitter_alerte(request, pk):
    """Acquitte une alerte et la marque comme résolue."""

    alerte = generics.get_object_or_404(AlerteSupervision, pk=pk)
    alerte.est_active = False
    alerte.date_resolution = datetime.now(tz=timezone_python.utc)
    alerte.acquittee_par = request.user
    alerte.save(update_fields=["est_active", "date_resolution", "acquittee_par"])
    return Response({"detail": "Alerte acquittée."})


@api_view(["GET"])
@permission_classes([EstSuperAdmin])
def vue_tableau_bord_supervision(request):
    """Résumé temps réel du système pour le tableau de bord de supervision."""

    return Response(_payload_tableau_bord_supervision())
