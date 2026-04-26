"""Vues API pour les organisations — Plateforme LBH."""

import json
from urllib import parse as urllib_parse
from urllib import request as urllib_request

from django.db.models import ProtectedError
from rest_framework import generics, permissions, filters
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

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
        obj = self.get_object()
        if obj.est_active:
            obj.est_active = False
            obj.save(update_fields=["est_active"])
            return Response({"detail": "Organisation désactivée.", "suppression_definitive": False})
        try:
            obj.delete()
        except ProtectedError:
            return Response(
                {
                    "detail": "Suppression définitive impossible : cette organisation est encore liée à des projets, utilisateurs ou documents.",
                    "suppression_definitive": False,
                },
                status=400,
            )
        return Response({"detail": "Organisation supprimée définitivement.", "suppression_definitive": True})


class VueGroupesOrganisation(generics.ListCreateAPIView):
    serializer_class = GroupeUtilisateursSerialiseur
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return GroupeUtilisateurs.objects.filter(
            organisation_id=self.kwargs["org_id"]
        ).prefetch_related("membres")

    def perform_create(self, serializer):
        serializer.save(organisation_id=self.kwargs["org_id"])


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def vue_recherche_entreprises_publiques(request):
    requete = (request.query_params.get("q") or "").strip()
    if len(requete) < 3:
        return Response({"results": []})

    try:
        limite = max(1, min(int(request.query_params.get("limit", "6")), 10))
    except ValueError as exc:
        raise ValidationError({"limit": "La limite doit être un entier."}) from exc

    url = "https://recherche-entreprises.api.gouv.fr/search?" + urllib_parse.urlencode(
        {"q": requete, "page": 1, "per_page": limite}
    )
    with urllib_request.urlopen(url, timeout=20) as reponse:
        donnees = json.loads(reponse.read().decode("utf-8"))

    resultats = []
    for entree in donnees.get("results", []):
        siege = entree.get("siege") or {}
        adresse_complete = " ".join(
            filtre
            for filtre in [
                siege.get("numero_voie"),
                siege.get("type_voie"),
                siege.get("libelle_voie"),
                siege.get("code_postal"),
                siege.get("libelle_commune"),
            ]
            if filtre
        ).strip()
        nature_juridique = entree.get("nature_juridique") or ""
        resultats.append(
            {
                "siren": entree.get("siren") or "",
                "siret": siege.get("siret") or "",
                "nom": entree.get("nom_complet") or entree.get("nom_raison_sociale") or "",
                "nom_raison_sociale": entree.get("nom_raison_sociale") or entree.get("nom_complet") or "",
                "sigle": entree.get("sigle") or "",
                "adresse": adresse_complete,
                "code_postal": siege.get("code_postal") or "",
                "ville": siege.get("libelle_commune") or "",
                "pays": "France",
                "etat_administratif": entree.get("etat_administratif") or "",
                "categorie_entreprise": entree.get("categorie_entreprise"),
                "nature_juridique": nature_juridique,
                "activite_principale": entree.get("activite_principale") or "",
                "tranche_effectif_salarie": entree.get("tranche_effectif_salarie"),
                "date_creation": entree.get("date_creation"),
                "est_service_public": "publique" in nature_juridique.lower() or "commune" in nature_juridique.lower(),
                "est_association": "association" in nature_juridique.lower(),
                "collectivite_territoriale": "Collectivité territoriale" if "commune" in nature_juridique.lower() or "departement" in nature_juridique.lower() else "",
                "siege_est_actif": siege.get("etat_administratif") == "A",
            }
        )

    return Response({"results": resultats})
