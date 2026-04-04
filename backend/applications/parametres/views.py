"""Vues API pour les paramètres système — Plateforme LBH."""

from rest_framework import generics, permissions, status, filters
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from .models import Parametre, FonctionnaliteActivable, JournalModificationParametre
from .serialiseurs import (
    ParametreSerialiseur,
    FonctionnaliteActivableSerialiseur,
    JournalModificationSerialiseur,
)


class EstSuperAdmin(permissions.BasePermission):
    """Seuls les super-admins peuvent modifier les paramètres système."""
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return request.user and request.user.is_authenticated
        return request.user and request.user.is_authenticated and request.user.est_super_admin


class VueListeParametres(generics.ListAPIView):
    """Liste de tous les paramètres, filtrables par module."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ParametreSerialiseur
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["cle", "libelle", "module"]
    ordering = ["module", "cle"]

    def get_queryset(self):
        qs = Parametre.objects.select_related("modifie_par")
        module = self.request.query_params.get("module")
        if module:
            qs = qs.filter(module__iexact=module)
        return qs


class VueDetailParametre(generics.RetrieveUpdateAPIView):
    """Consultation et modification d'un paramètre."""
    permission_classes = [EstSuperAdmin]
    serializer_class = ParametreSerialiseur
    queryset = Parametre.objects.select_related("modifie_par")
    lookup_field = "cle"

    def perform_update(self, serializer):
        ancienne_valeur = serializer.instance.valeur
        instance = serializer.save(modifie_par=self.request.user)
        if instance.valeur != ancienne_valeur:
            JournalModificationParametre.objects.create(
                parametre=instance,
                ancienne_valeur=ancienne_valeur,
                nouvelle_valeur=instance.valeur,
                modifie_par=self.request.user,
            )


@api_view(["POST"])
@permission_classes([EstSuperAdmin])
def vue_reinitialiser_parametre(request, cle):
    """Remet un paramètre à sa valeur par défaut."""
    parametre = generics.get_object_or_404(Parametre, cle=cle)
    if parametre.est_verrouille:
        return Response(
            {"detail": "Ce paramètre est verrouillé."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    ancienne_valeur = parametre.valeur
    parametre.valeur = parametre.valeur_par_defaut
    parametre.modifie_par = request.user
    parametre.save(update_fields=["valeur", "modifie_par"])
    JournalModificationParametre.objects.create(
        parametre=parametre,
        ancienne_valeur=ancienne_valeur,
        nouvelle_valeur=parametre.valeur,
        modifie_par=request.user,
    )
    return Response({"detail": f"Paramètre réinitialisé à « {parametre.valeur} »."})


class VueListeFonctionnalites(generics.ListAPIView):
    """Liste de toutes les fonctionnalités activables."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = FonctionnaliteActivableSerialiseur
    queryset = FonctionnaliteActivable.objects.select_related(
        "organisation", "profil", "utilisateur", "modifie_par"
    ).filter(niveau_controle="systeme").order_by("code")


@api_view(["PATCH"])
@permission_classes([EstSuperAdmin])
def vue_basculer_fonctionnalite(request, code):
    """Active ou désactive une fonctionnalité (niveau système uniquement)."""
    fonctionnalite = generics.get_object_or_404(
        FonctionnaliteActivable, code=code, niveau_controle="systeme"
    )
    etat = request.data.get("est_active")
    if etat is None:
        return Response(
            {"detail": "Le champ « est_active » est requis."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    fonctionnalite.est_active = bool(etat)
    fonctionnalite.modifie_par = request.user
    fonctionnalite.save(update_fields=["est_active", "modifie_par"])
    etat_libelle = "activée" if fonctionnalite.est_active else "désactivée"
    return Response({"detail": f"Fonctionnalité « {code} » {etat_libelle}."})


class VueJournalParametres(generics.ListAPIView):
    """Journal des modifications de paramètres (lecture seule)."""
    permission_classes = [EstSuperAdmin]
    serializer_class = JournalModificationSerialiseur

    def get_queryset(self):
        qs = JournalModificationParametre.objects.select_related(
            "parametre", "modifie_par"
        )
        cle = self.request.query_params.get("cle")
        if cle:
            qs = qs.filter(parametre__cle=cle)
        return qs
