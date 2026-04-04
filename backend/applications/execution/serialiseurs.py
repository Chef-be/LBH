"""Sérialiseurs pour le suivi d'exécution des travaux — Plateforme BEE."""

from rest_framework import serializers
from .models import (
    SuiviExecution,
    CompteRenduChantier,
    SituationTravaux,
    OrdreService,
    PlanningChantier,
    TachePlanning,
    DependanceTachePlanning,
    AffectationEquipeTache,
)


class OrdreServiceSerialiseur(serializers.ModelSerializer):
    type_libelle = serializers.CharField(source="get_type_ordre_display", read_only=True)

    class Meta:
        model = OrdreService
        fields = [
            "id", "suivi", "numero", "type_ordre", "type_libelle",
            "date_emission", "objet", "contenu",
        ]
        read_only_fields = ["id", "type_libelle"]
        extra_kwargs = {
            "suivi": {"required": False, "allow_null": True},
        }


class SituationTravauxSerialiseur(serializers.ModelSerializer):
    statut_libelle = serializers.CharField(source="get_statut_display", read_only=True)

    class Meta:
        model = SituationTravaux
        fields = [
            "id", "suivi", "numero",
            "periode_debut", "periode_fin",
            "statut", "statut_libelle",
            "montant_cumule_ht", "montant_periode_ht",
            "avancement_financier_pct",
            "date_creation", "date_modification",
        ]
        read_only_fields = ["id", "date_creation", "date_modification", "statut_libelle"]
        extra_kwargs = {
            "suivi": {"required": False, "allow_null": True},
        }
        validators = []


class CompteRenduChantierSerialiseur(serializers.ModelSerializer):
    redacteur_nom = serializers.SerializerMethodField()

    class Meta:
        model = CompteRenduChantier
        fields = [
            "id", "suivi", "numero", "date_reunion",
            "redacteur", "redacteur_nom",
            "ordre_du_jour", "contenu", "decisions",
            "avancement_physique_pct",
            "date_creation", "date_diffusion",
        ]
        read_only_fields = ["id", "date_creation", "redacteur_nom"]
        extra_kwargs = {
            "suivi": {"required": False, "allow_null": True},
            "redacteur": {"required": False, "allow_null": True},
        }
        validators = []

    def get_redacteur_nom(self, obj):
        if obj.redacteur:
            return f"{obj.redacteur.prenom} {obj.redacteur.nom}"
        return None


class SuiviExecutionSerialiseur(serializers.ModelSerializer):
    montant_total_ht = serializers.SerializerMethodField()
    entreprise_nom = serializers.SerializerMethodField()
    projet_reference = serializers.CharField(source="projet.reference", read_only=True)
    total_processus = serializers.IntegerField(read_only=True)
    nb_processus_maitrises = serializers.IntegerField(read_only=True)
    taux_maitrise_processus = serializers.IntegerField(read_only=True)

    class Meta:
        model = SuiviExecution
        fields = [
            "id", "projet", "projet_reference",
            "entreprise_principale", "entreprise_nom",
            "date_os_demarrage", "duree_contractuelle_jours", "date_fin_contractuelle",
            "montant_marche_ht", "montant_travaux_supplementaires_ht", "montant_total_ht",
            "processus_maitrise", "points_vigilance", "prochaines_actions", "observations_pilotage",
            "total_processus", "nb_processus_maitrises", "taux_maitrise_processus",
            "date_creation", "date_modification",
        ]
        read_only_fields = [
            "id", "date_creation", "date_modification",
            "montant_total_ht", "entreprise_nom", "projet_reference",
            "total_processus", "nb_processus_maitrises", "taux_maitrise_processus",
        ]

    def get_montant_total_ht(self, obj):
        return float(obj.montant_total_ht)

    def get_entreprise_nom(self, obj):
        if obj.entreprise_principale:
            return obj.entreprise_principale.nom
        return None


class AffectationEquipeTacheSerialiseur(serializers.ModelSerializer):
    profil_libelle = serializers.CharField(source="profil.libelle", read_only=True)

    class Meta:
        model = AffectationEquipeTache
        fields = [
            "id", "tache", "profil", "profil_libelle", "effectif",
            "rendement_relatif", "est_chef_equipe",
        ]
        read_only_fields = ["id", "profil_libelle"]
        extra_kwargs = {
            "tache": {"required": False, "allow_null": True},
        }


class DependanceTachePlanningSerialiseur(serializers.ModelSerializer):
    tache_amont_designation = serializers.CharField(source="tache_amont.designation", read_only=True)
    tache_aval_designation = serializers.CharField(source="tache_aval.designation", read_only=True)
    type_dependance_libelle = serializers.CharField(source="get_type_dependance_display", read_only=True)

    class Meta:
        model = DependanceTachePlanning
        fields = [
            "id", "tache_amont", "tache_amont_designation",
            "tache_aval", "tache_aval_designation",
            "type_dependance", "type_dependance_libelle", "decalage_jours",
        ]
        read_only_fields = ["id", "tache_amont_designation", "tache_aval_designation", "type_dependance_libelle"]

    def validate(self, attrs):
        tache_amont = attrs.get("tache_amont") or getattr(self.instance, "tache_amont", None)
        tache_aval = attrs.get("tache_aval") or getattr(self.instance, "tache_aval", None)
        if not tache_amont or not tache_aval:
            return attrs
        if tache_amont_id := getattr(tache_amont, "id", None):
            if tache_amont_id == getattr(tache_aval, "id", None):
                raise serializers.ValidationError("Une tâche ne peut pas dépendre d'elle-même.")
        if tache_amont.planning_id != tache_aval.planning_id:
            raise serializers.ValidationError("Les deux tâches d'une dépendance doivent appartenir au même planning.")
        return attrs


class TachePlanningSerialiseur(serializers.ModelSerializer):
    affectations_equipe = AffectationEquipeTacheSerialiseur(many=True, read_only=True)
    dependances_entrantes = DependanceTachePlanningSerialiseur(many=True, read_only=True)
    ref_ligne_economique_code = serializers.CharField(source="ref_ligne_economique.code", read_only=True)
    ref_ligne_prix_code = serializers.CharField(source="ref_ligne_prix.code", read_only=True)

    class Meta:
        model = TachePlanning
        fields = [
            "id", "planning", "numero_ordre", "code", "designation", "unite",
            "quantite", "temps_unitaire_heures", "heures_totales",
            "effectif_alloue", "duree_jours", "decalage_jours",
            "date_debut_calculee", "date_fin_calculee",
            "marge_libre_jours", "est_critique", "mode_calcul",
            "ref_ligne_economique", "ref_ligne_economique_code",
            "ref_ligne_prix", "ref_ligne_prix_code",
            "metadata_calcul", "observations",
            "affectations_equipe", "dependances_entrantes",
        ]
        read_only_fields = [
            "id", "heures_totales", "date_debut_calculee", "date_fin_calculee",
            "marge_libre_jours", "est_critique", "metadata_calcul",
            "ref_ligne_economique_code", "ref_ligne_prix_code",
        ]
        extra_kwargs = {
            "planning": {"required": False, "allow_null": True},
        }


class PlanningChantierSerialiseur(serializers.ModelSerializer):
    taches = TachePlanningSerialiseur(many=True, read_only=True)
    projet_reference = serializers.CharField(source="suivi.projet.reference", read_only=True)
    etude_economique_intitule = serializers.CharField(source="etude_economique.intitule", read_only=True)
    etude_prix_intitule = serializers.CharField(source="etude_prix.intitule", read_only=True)
    source_donnees_libelle = serializers.CharField(source="get_source_donnees_display", read_only=True)

    class Meta:
        model = PlanningChantier
        fields = [
            "id", "suivi", "projet_reference", "intitule",
            "source_donnees", "source_donnees_libelle",
            "etude_economique", "etude_economique_intitule",
            "etude_prix", "etude_prix_intitule",
            "date_debut_reference", "heures_par_jour", "coefficient_rendement_global",
            "jours_ouvres", "jours_feries", "lisser_ressources_partagees",
            "chemin_critique", "synthese_calcul", "taches",
            "date_creation", "date_modification",
        ]
        read_only_fields = [
            "id", "projet_reference", "source_donnees_libelle",
            "etude_economique_intitule", "etude_prix_intitule",
            "chemin_critique", "synthese_calcul", "date_creation", "date_modification",
        ]
        extra_kwargs = {
            "suivi": {"required": False, "allow_null": True},
        }
