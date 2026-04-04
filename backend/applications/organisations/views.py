"""Vues API pour les organisations — Plateforme BEE."""

from rest_framework import generics, permissions, filters
from .models import Organisation, GroupeUtilisateurs
from .serialiseurs import OrganisationSerialiseur, GroupeUtilisateursSerialiseur


class VueListeOrganisations(generics.ListCreateAPIView):
    serializer_class = OrganisationSerialiseur
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["nom", "code", "siret", "ville"]
    ordering = ["nom"]

    def get_queryset(self):
        qs = Organisation.objects.all()
        type_org = self.request.query_params.get("type")
        if type_org:
            qs = qs.filter(type_organisation=type_org)
        if not self.request.user.est_super_admin:
            qs = qs.filter(est_active=True)
        return qs


class VueDetailOrganisation(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = OrganisationSerialiseur
    permission_classes = [permissions.IsAuthenticated]
    queryset = Organisation.objects.all()

    def destroy(self, request, *args, **kwargs):
        from rest_framework.response import Response
        obj = self.get_object()
        obj.est_active = False
        obj.save(update_fields=["est_active"])
        return Response({"detail": "Organisation désactivée."})


class VueGroupesOrganisation(generics.ListCreateAPIView):
    serializer_class = GroupeUtilisateursSerialiseur
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return GroupeUtilisateurs.objects.filter(
            organisation_id=self.kwargs["org_id"]
        ).prefetch_related("membres")

    def perform_create(self, serializer):
        serializer.save(organisation_id=self.kwargs["org_id"])
