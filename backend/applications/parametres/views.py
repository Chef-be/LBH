"""Vues API pour les paramètres système — Plateforme LBH."""

from django.db import models
from django.db.models import Count, Sum
from django.utils import timezone
from rest_framework import generics, permissions, status, filters
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from .models import (
    ConfigurationIAFonctionnelle,
    FonctionnaliteActivable,
    JournalModificationParametre,
    Parametre,
    TraitementIA,
)
from .serialiseurs import (
    ConfigurationIAFonctionnelleSerialiseur,
    ParametreSerialiseur,
    FonctionnaliteActivableSerialiseur,
    JournalModificationSerialiseur,
    TraitementIASerialiseur,
)
from .services_ia_metier import (
    ErreurFournisseurMetier,
    lister_modeles_disponibles,
    tester_configuration_ia,
)


class EstSuperAdmin(permissions.BasePermission):
    """Seuls les super-admins peuvent modifier les paramètres système."""
    def has_permission(self, request, view):
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


class VueListeConfigurationsIA(generics.ListCreateAPIView):
    """Configurations des traitements métier automatisés."""

    permission_classes = [EstSuperAdmin]
    serializer_class = ConfigurationIAFonctionnelleSerialiseur

    def get_queryset(self):
        qs = ConfigurationIAFonctionnelle.objects.all()
        module = self.request.query_params.get("module")
        if module:
            qs = qs.filter(module=module)
        actif = self.request.query_params.get("actif")
        if actif == "1":
            qs = qs.filter(est_actif=True)
        fournisseur = self.request.query_params.get("fournisseur")
        if fournisseur:
            qs = qs.filter(fournisseur=fournisseur)
        erreurs = self.request.query_params.get("erreurs")
        if erreurs == "1":
            qs = qs.filter(traitements__statut="erreur").distinct()
        return qs


class VueDetailConfigurationIA(generics.RetrieveUpdateAPIView):
    permission_classes = [EstSuperAdmin]
    serializer_class = ConfigurationIAFonctionnelleSerialiseur
    queryset = ConfigurationIAFonctionnelle.objects.all()


class VueListeJournauxIA(generics.ListAPIView):
    permission_classes = [EstSuperAdmin]
    serializer_class = TraitementIASerialiseur

    def get_queryset(self):
        qs = TraitementIA.objects.select_related("configuration", "utilisateur").prefetch_related("corrections")
        module = self.request.query_params.get("module")
        if module:
            qs = qs.filter(module=module)
        configuration = self.request.query_params.get("configuration")
        if configuration:
            qs = qs.filter(configuration_id=configuration)
        statut = self.request.query_params.get("statut")
        if statut:
            qs = qs.filter(statut=statut)
        return qs


@api_view(["GET"])
@permission_classes([EstSuperAdmin])
def vue_couts_ia(request):
    """Synthèse des coûts journalisés par module."""

    lignes = (
        TraitementIA.objects.values("module")
        .annotate(cout_estime_total=Sum("cout_estime"), cout_reel_total=Sum("cout_reel"))
        .order_by("module")
    )
    return Response({
        "couts": list(lignes),
        "total_estime": TraitementIA.objects.aggregate(total=Sum("cout_estime"))["total"] or 0,
        "total_reel": TraitementIA.objects.aggregate(total=Sum("cout_reel"))["total"] or 0,
    })


@api_view(["GET"])
@permission_classes([EstSuperAdmin])
def vue_modeles_disponibles_ia(request):
    """Liste les modèles disponibles depuis le fournisseur configuré côté serveur."""

    fournisseur = request.query_params.get("fournisseur", "openai")
    try:
        return Response(lister_modeles_disponibles(fournisseur=fournisseur))
    except ErreurFournisseurMetier as exc:
        return Response(
            {"fournisseur": fournisseur, "disponible": False, "modeles": [], "detail": str(exc)},
            status=status.HTTP_400_BAD_REQUEST,
        )


PRESETS_IA = {
    "analyse_devis": {
        "libelle": "Analyse devis / BPU / DPGF / DQE",
        "module": "ressources_devis",
        "prompt_systeme": "Tu analyses des lignes de devis BTP pour un économiste de la construction. Tu proposes des corrections sans les appliquer automatiquement.",
        "prompt_controle": "Contrôle les lignes, détecte les anomalies de prix, d'unité, de quantité et les libellés non capitalisables.",
        "schema_sortie": {"resume": "texte", "anomalies": [], "corrections": [], "score_confiance": 0.0},
        "options_metier": {"correction_libelles": True, "normalisation_unites": True, "classification_corps_etat": True, "rapprochement_bibliotheque": True, "detection_doublons": True, "detection_prix_incoherents": True, "proposition_capitalisation": True, "seuil_capitalisation": 0.92},
    },
    "normalisation_prix_marche": {
        "libelle": "Normalisation prix marché",
        "module": "ressources_prix_marche",
        "prompt_systeme": "Tu normalises des lignes de prix marché BTP en conservant le sens technique et l'unité.",
        "prompt_controle": "Détecte les doublons, les prix similaires, les unités suspectes et propose une classification par corps d'état.",
        "schema_sortie": {"lignes_a_verifier": [], "doublons_potentiels": [], "corrections": []},
        "options_metier": {"normalisation": True, "fusion_doublons": False, "rapprochement_prix_similaires": True, "enrichissement_description": True, "detection_prix_atypiques": True, "classification_corps_etat": True},
    },
    "estimation_ratios": {
        "libelle": "Estimation par ratios",
        "module": "ressources_estimations",
        "prompt_systeme": "Tu aides à produire une estimation par ratios pour des opérations de construction avec hypothèses explicites.",
        "prompt_controle": "Génère des scénarios, contrôle les postes manquants et cite les références internes disponibles.",
        "schema_sortie": {"scenarios": [], "hypotheses": [], "alertes": []},
        "options_metier": {"generation_ratios": True, "scenarios_budgetaires": True, "note_hypotheses": True, "controle_coherence": True, "comparaison_prix_marche": True},
    },
    "generation_article_cctp": {
        "libelle": "Génération article CCTP",
        "module": "bibliotheque_cctp",
        "prompt_systeme": "Tu rédiges des articles CCTP structurés pour une bibliothèque interne. Tout contenu généré reste à vérifier par un humain.",
        "prompt_controle": "Produis un article technique structuré, original, sans copier de source externe, avec limites, contrôles, variantes et déchets.",
        "schema_sortie": {"titre": "", "designation_courte": "", "description_technique": "", "cahier_des_charges": "", "mise_en_oeuvre": "", "controles": "", "limites_prestation": "", "options": [], "variantes": [], "dechets": "", "mots_cles": [], "unite_suggeree": "", "corps_etat": "", "justification": ""},
        "options_metier": {"generation_descriptif": True, "cahier_des_charges": True, "exigences_mise_en_oeuvre": True, "controles_attendus": True, "limites_prestation": True, "variantes": True, "dechets": True, "normes_references": True, "statut_a_verifier_obligatoire": True},
    },
    "recherche_bibliotheque": {
        "libelle": "Recherche intelligente bibliothèque",
        "module": "bibliotheque_prix",
        "prompt_systeme": "Tu aides à rechercher des articles et prix dans une bibliothèque BTP interne à partir d'une intention métier.",
        "prompt_controle": "Retourne des résultats groupés avec score de pertinence et justification courte.",
        "schema_sortie": {"resultats": [], "requete_normalisee": "", "mots_cles": []},
        "options_metier": {"recherche_semantique": True, "similarite": True, "suggestions": True},
    },
    "audit_ligne_prix": {
        "libelle": "Audit de ligne de prix",
        "module": "ressources_prix_marche",
        "prompt_systeme": "Tu audites une ligne de prix BTP en vérifiant cohérence technique, unité et ordre de grandeur.",
        "prompt_controle": "Classe le risque, explique l'écart et propose une correction à valider.",
        "schema_sortie": {"risque": "", "explication": "", "correction_proposee": {}},
        "options_metier": {"detection_prix_atypiques": True, "correction_ia": True},
    },
    "decomposition_prix": {
        "libelle": "Décomposition de prix",
        "module": "bibliotheque_prix",
        "prompt_systeme": "Tu proposes une décomposition de prix BTP en matériaux, main d'oeuvre, matériel et frais.",
        "prompt_controle": "Retourne une décomposition justifiée, sans application automatique.",
        "schema_sortie": {"composants": [], "hypotheses": [], "score_confiance": 0.0},
        "options_metier": {"decomposition": True, "validation_humaine_obligatoire": True},
    },
}


@api_view(["GET"])
@permission_classes([EstSuperAdmin])
def vue_presets_ia(request):
    """Retourne les préréglages métier disponibles."""

    return Response({"presets": [{"code": code, **donnees} for code, donnees in PRESETS_IA.items()]})


@api_view(["GET"])
@permission_classes([EstSuperAdmin])
def vue_synthese_ia(request):
    """Synthèse d'administration par module."""

    modules = dict(ConfigurationIAFonctionnelle.MODULES)
    traitements = (
        TraitementIA.objects.values("module")
        .annotate(
            nombre=Count("id"),
            erreurs=Count("id", filter=models.Q(statut="erreur")),
            cout_estime=Sum("cout_estime"),
            cout_reel=Sum("cout_reel"),
        )
    )
    traitements_par_module = {ligne["module"]: ligne for ligne in traitements}
    configurations = (
        ConfigurationIAFonctionnelle.objects.values("module")
        .annotate(configurations=Count("id"), actives=Count("id", filter=models.Q(est_actif=True)))
    )
    configurations_par_module = {ligne["module"]: ligne for ligne in configurations}
    lignes = []
    for code, libelle in modules.items():
        dernier = TraitementIA.objects.filter(module=code).order_by("-date_creation").first()
        stats_traitements = traitements_par_module.get(code, {})
        stats_config = configurations_par_module.get(code, {})
        lignes.append({
            "module": code,
            "libelle": libelle,
            "configurations": stats_config.get("configurations", 0),
            "configurations_actives": stats_config.get("actives", 0),
            "dernier_traitement": TraitementIASerialiseur(dernier).data if dernier else None,
            "erreurs": stats_traitements.get("erreurs", 0),
            "cout_estime": stats_traitements.get("cout_estime") or 0,
            "cout_reel": stats_traitements.get("cout_reel") or 0,
        })
    return Response({"modules": lignes})


@api_view(["POST"])
@permission_classes([EstSuperAdmin])
def vue_tester_configuration_ia(request, pk):
    """Teste une configuration en simulation ou en mode réel selon la demande."""

    configuration = generics.get_object_or_404(ConfigurationIAFonctionnelle, pk=pk)
    prompt = request.data.get("prompt") or request.data.get("prompt_test") or configuration.prompt_controle or configuration.prompt_systeme
    mode = request.data.get("mode") or "simulation"
    if mode not in {"simulation", "reel"}:
        return Response({"detail": "Le mode de test doit être « simulation » ou « reel »."}, status=status.HTTP_400_BAD_REQUEST)
    traitement = tester_configuration_ia(
        configuration,
        prompt,
        utilisateur=request.user,
        mode=mode,
        jeu_donnees=request.data.get("jeu_donnees") or {},
    )
    detail = "Test simulé journalisé." if traitement.mode_execution == "simulation" else "Test réel journalisé."
    if traitement.statut == "erreur":
        detail = "Test terminé avec une erreur locale."
    return Response({
        "detail": detail,
        "traitement": TraitementIASerialiseur(traitement).data,
    })
