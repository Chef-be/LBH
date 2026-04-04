"""Vues API pour le suivi d'exécution des travaux — Plateforme LBH."""

from io import BytesIO

from django.http import FileResponse
from rest_framework import generics, permissions, status, filters
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from .models import (
    SuiviExecution,
    CompteRenduChantier,
    SituationTravaux,
    OrdreService,
    PlanningChantier,
    TachePlanning,
    DependanceTachePlanning,
)
from .serialiseurs import (
    SuiviExecutionSerialiseur,
    CompteRenduChantierSerialiseur,
    SituationTravauxSerialiseur,
    OrdreServiceSerialiseur,
    PlanningChantierSerialiseur,
    TachePlanningSerialiseur,
    DependanceTachePlanningSerialiseur,
)
from .services import (
    recalculer_planning,
    regenerer_taches_planning_depuis_sources,
    mettre_a_jour_affectations_tache,
    exporter_planning_xlsx,
    exporter_planning_pdf,
    exporter_planning_archives,
)


class VueListeSuivisExecution(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = SuiviExecutionSerialiseur
    filter_backends = [filters.SearchFilter]
    search_fields = ["projet__reference"]

    def get_queryset(self):
        qs = SuiviExecution.objects.select_related("projet", "entreprise_principale")
        projet_id = self.request.query_params.get("projet")
        if projet_id:
            qs = qs.filter(projet_id=projet_id)
        return qs


class VueDetailSuiviExecution(generics.RetrieveUpdateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = SuiviExecutionSerialiseur
    queryset = SuiviExecution.objects.select_related("projet", "entreprise_principale")


class VueListeComptesRendus(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = CompteRenduChantierSerialiseur
    ordering = ["-date_reunion"]

    def get_queryset(self):
        return CompteRenduChantier.objects.filter(
            suivi_id=self.kwargs["suivi_id"]
        ).select_related("redacteur")

    def perform_create(self, serializer):
        suivi = generics.get_object_or_404(SuiviExecution, pk=self.kwargs["suivi_id"])
        serializer.save(suivi=suivi, redacteur=self.request.user)


class VueDetailCompteRendu(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = CompteRenduChantierSerialiseur

    def get_queryset(self):
        return CompteRenduChantier.objects.filter(suivi_id=self.kwargs["suivi_id"])


class VueListeSituations(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = SituationTravauxSerialiseur
    ordering = ["numero"]

    def get_queryset(self):
        return SituationTravaux.objects.filter(suivi_id=self.kwargs["suivi_id"])

    def perform_create(self, serializer):
        suivi = generics.get_object_or_404(SuiviExecution, pk=self.kwargs["suivi_id"])
        serializer.save(suivi=suivi)


class VueDetailSituation(generics.RetrieveUpdateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = SituationTravauxSerialiseur

    def get_queryset(self):
        return SituationTravaux.objects.filter(suivi_id=self.kwargs["suivi_id"])


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def vue_valider_situation(request, suivi_id, pk):
    situation = generics.get_object_or_404(SituationTravaux, pk=pk, suivi_id=suivi_id)
    situation.statut = "validee_moa"
    situation.save(update_fields=["statut"])
    return Response({"detail": f"Situation n°{situation.numero} validée par la MOA."})


class VueListeOrdresService(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = OrdreServiceSerialiseur
    ordering = ["numero"]

    def get_queryset(self):
        return OrdreService.objects.filter(suivi_id=self.kwargs["suivi_id"])

    def perform_create(self, serializer):
        suivi = generics.get_object_or_404(SuiviExecution, pk=self.kwargs["suivi_id"])
        serializer.save(suivi=suivi)


class VueDetailOrdreService(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = OrdreServiceSerialiseur

    def get_queryset(self):
        return OrdreService.objects.filter(suivi_id=self.kwargs["suivi_id"])


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def vue_resume_execution(request):
    """
    Tableau de bord d'exécution : résumé des projets en cours,
    situations à valider et ordres de service actifs.
    """
    suivis = SuiviExecution.objects.select_related("projet").prefetch_related(
        "comptes_rendus", "situations", "ordres_service"
    )

    projets_en_execution = []
    for suivi in suivis:
        nb_cr = suivi.comptes_rendus.count()
        nb_sit = suivi.situations.count()
        nb_os = suivi.ordres_service.count()
        if nb_cr + nb_sit + nb_os == 0:
            continue
        derniere = None
        champs_date = [
            (suivi.comptes_rendus, "date_creation"),
            (suivi.situations, "date_modification"),
            (suivi.ordres_service, "date_emission"),
        ]
        for qs, champ in champs_date:
            try:
                dernier = qs.latest(champ)
                val = getattr(dernier, champ)
                if hasattr(val, "date"):
                    val = val.date()
                if derniere is None or val > derniere:
                    derniere = val
            except Exception:
                pass
        projets_en_execution.append({
            "projet_id": str(suivi.projet_id),
            "projet_reference": suivi.projet.reference,
            "projet_intitule": suivi.projet.intitule,
            "nb_cr_chantier": nb_cr,
            "nb_situations": nb_sit,
            "nb_os": nb_os,
            "derniere_activite": derniere.isoformat() if derniere else None,
        })

    total_situations_a_valider = SituationTravaux.objects.filter(
        statut__in=["soumise", "acceptee"]
    ).count()

    total_os_en_cours = OrdreService.objects.filter(
        type_ordre__in=["demarrage", "modification"]
    ).count()

    return Response({
        "projets_en_execution": projets_en_execution,
        "total_situations_a_valider": total_situations_a_valider,
        "total_os_en_cours": total_os_en_cours,
    })


class VueListePlanningsChantier(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = PlanningChantierSerialiseur
    ordering = ["-date_modification"]

    def get_queryset(self):
        return PlanningChantier.objects.filter(
            suivi_id=self.kwargs["suivi_id"]
        ).select_related("suivi__projet", "etude_economique", "etude_prix").prefetch_related(
            "taches__affectations_equipe",
            "taches__dependances_entrantes__tache_amont",
        )

    def perform_create(self, serializer):
        suivi = generics.get_object_or_404(SuiviExecution, pk=self.kwargs["suivi_id"])
        planning = serializer.save(suivi=suivi)
        regenerer_taches_planning_depuis_sources(planning)


class VueDetailPlanningChantier(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = PlanningChantierSerialiseur

    def get_queryset(self):
        return PlanningChantier.objects.select_related(
            "suivi__projet", "etude_economique", "etude_prix"
        ).prefetch_related(
            "taches__affectations_equipe",
            "taches__dependances_entrantes__tache_amont",
        )

    def perform_update(self, serializer):
        planning = serializer.save()
        try:
            recalculer_planning(planning)
        except ValueError as exc:
            raise ValidationError(str(exc))


class VueListeTachesPlanning(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = TachePlanningSerialiseur

    def get_queryset(self):
        return TachePlanning.objects.filter(planning_id=self.kwargs["planning_id"]).prefetch_related(
            "affectations_equipe", "dependances_entrantes__tache_amont"
        ).order_by("numero_ordre", "designation")

    def perform_create(self, serializer):
        planning = generics.get_object_or_404(PlanningChantier, pk=self.kwargs["planning_id"])
        tache = serializer.save(planning=planning)
        try:
            recalculer_planning(planning)
        except ValueError as exc:
            raise ValidationError(str(exc))


class VueDetailTachePlanning(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = TachePlanningSerialiseur

    def get_queryset(self):
        return TachePlanning.objects.filter(planning_id=self.kwargs["planning_id"]).prefetch_related(
            "affectations_equipe", "dependances_entrantes__tache_amont"
        )

    def perform_update(self, serializer):
        tache = serializer.save()
        try:
            recalculer_planning(tache.planning)
        except ValueError as exc:
            raise ValidationError(str(exc))

    def perform_destroy(self, instance):
        planning = instance.planning
        instance.delete()
        try:
            recalculer_planning(planning)
        except ValueError as exc:
            raise ValidationError(str(exc))


class VueListeDependancesPlanning(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = DependanceTachePlanningSerialiseur

    def get_queryset(self):
        return DependanceTachePlanning.objects.filter(
            tache_aval__planning_id=self.kwargs["planning_id"]
        ).select_related("tache_amont", "tache_aval").order_by(
            "tache_aval__numero_ordre", "tache_amont__numero_ordre"
        )

    def perform_create(self, serializer):
        dependance = serializer.save()
        try:
            recalculer_planning(dependance.tache_aval.planning)
        except ValueError as exc:
            dependance.delete()
            raise ValidationError(str(exc))


class VueDetailDependancePlanning(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = DependanceTachePlanningSerialiseur

    def get_queryset(self):
        return DependanceTachePlanning.objects.filter(
            tache_aval__planning_id=self.kwargs["planning_id"]
        ).select_related("tache_amont", "tache_aval")

    def perform_update(self, serializer):
        dependance = serializer.save()
        try:
            recalculer_planning(dependance.tache_aval.planning)
        except ValueError as exc:
            raise ValidationError(str(exc))

    def perform_destroy(self, instance):
        planning = instance.tache_aval.planning
        instance.delete()
        try:
            recalculer_planning(planning)
        except ValueError as exc:
            raise ValidationError(str(exc))


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def vue_regenerer_planning(request, planning_id):
    planning = generics.get_object_or_404(PlanningChantier, pk=planning_id)
    try:
        total = regenerer_taches_planning_depuis_sources(planning)
    except ValueError as exc:
        raise ValidationError(str(exc))
    return Response({"detail": "Planning régénéré.", "nb_taches": total})


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def vue_recalculer_planning(request, planning_id):
    planning = generics.get_object_or_404(PlanningChantier, pk=planning_id)
    try:
        synthese = recalculer_planning(planning)
    except ValueError as exc:
        raise ValidationError(str(exc))
    return Response({"detail": "Planning recalculé.", "synthese": synthese})


@api_view(["PUT"])
@permission_classes([permissions.IsAuthenticated])
def vue_affecter_equipe_tache(request, planning_id, pk):
    tache = generics.get_object_or_404(TachePlanning, pk=pk, planning_id=planning_id)
    affectations = request.data.get("affectations") or []
    if not isinstance(affectations, list):
        return Response({"detail": "Le champ « affectations » doit être une liste."}, status=status.HTTP_400_BAD_REQUEST)
    try:
        mettre_a_jour_affectations_tache(tache, affectations)
    except ValueError as exc:
        raise ValidationError(str(exc))
    return Response(TachePlanningSerialiseur(tache).data)


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def vue_exporter_planning_xlsx(request, planning_id):
    planning = generics.get_object_or_404(
        PlanningChantier.objects.select_related("suivi__projet"),
        pk=planning_id,
    )
    contenu = exporter_planning_xlsx(planning)
    nom = f"{(planning.intitule or 'planning-chantier').replace('/', '-')}.xlsx"
    reponse = FileResponse(
        BytesIO(contenu),
        as_attachment=True,
        filename=nom,
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
    reponse["Content-Length"] = str(len(contenu))
    return reponse


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def vue_exporter_planning_pdf(request, planning_id):
    planning = generics.get_object_or_404(
        PlanningChantier.objects.select_related("suivi__projet"),
        pk=planning_id,
    )
    contenu = exporter_planning_pdf(planning)
    nom = f"{(planning.intitule or 'planning-chantier').replace('/', '-')}.pdf"
    reponse = FileResponse(
        BytesIO(contenu),
        as_attachment=True,
        filename=nom,
        content_type="application/pdf",
    )
    reponse["Content-Length"] = str(len(contenu))
    return reponse


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def vue_exporter_planning_archive(request, planning_id):
    planning = generics.get_object_or_404(
        PlanningChantier.objects.select_related("suivi__projet"),
        pk=planning_id,
    )
    contenu = exporter_planning_archives(planning)
    nom = f"{(planning.intitule or 'planning-chantier').replace('/', '-')}.zip"
    reponse = FileResponse(
        BytesIO(contenu),
        as_attachment=True,
        filename=nom,
        content_type="application/zip",
    )
    reponse["Content-Length"] = str(len(contenu))
    return reponse
