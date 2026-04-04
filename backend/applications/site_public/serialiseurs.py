"""Sérialiseurs pour le site vitrine public — Plateforme BEE."""

import json
from django.core.files.uploadedfile import UploadedFile
from rest_framework import serializers
from .contenu_accueil import contenu_accueil_par_defaut
from .contenus_pages import contenus_pages_par_defaut
from .models import (
    Prestation, Realisation, MembreEquipe, DemandeContact,
    ConfigurationSite, StatistiqueSite, ValeurSite, EtapeDemarche,
    ConfigurationRGPD, PageStatique, Actualite,
)


class PrestationSerialiseur(serializers.ModelSerializer):
    class Meta:
        model = Prestation
        fields = [
            "id", "slug", "titre", "categorie",
            "description_courte", "description_longue",
            "icone", "couleur", "points_forts",
            "titre_page", "accroche_page", "avantages", "livrables",
            "meta_titre", "meta_description",
            "ordre_affichage", "est_publie", "date_modification",
        ]
        read_only_fields = ["id", "date_modification"]


class PrestationResumeSerialiseur(serializers.ModelSerializer):
    """Version allégée pour les listes et la page d'accueil."""
    class Meta:
        model = Prestation
        fields = [
            "id", "slug", "titre", "categorie",
            "description_courte", "icone", "couleur", "points_forts",
            "ordre_affichage",
        ]
        read_only_fields = ["id", "date_modification"]


class StatistiqueSiteSerialiseur(serializers.ModelSerializer):
    class Meta:
        model = StatistiqueSite
        fields = ["id", "valeur", "unite", "libelle", "ordre_affichage", "est_publie"]
        read_only_fields = ["id"]


class ValeurSiteSerialiseur(serializers.ModelSerializer):
    class Meta:
        model = ValeurSite
        fields = ["id", "icone", "titre", "description", "ordre_affichage", "est_publiee"]
        read_only_fields = ["id"]


class EtapeDemarcheSerialiseur(serializers.ModelSerializer):
    class Meta:
        model = EtapeDemarche
        fields = ["id", "numero", "titre", "description", "ordre_affichage", "est_publiee"]
        read_only_fields = ["id"]


class ConfigurationSiteSerialiseur(serializers.ModelSerializer):
    champs_media = ("logo", "logo_pied_de_page", "favicon")
    meta_titres_legacy = {
        "BEE — Bureau d'Études Économiste",
        "BEE - Bureau d'Études Économiste",
        "BEE -- Bureau d'Études Économiste",
        "BEE — Bureau d'Etudes Economiste",
        "BEE - Bureau d'Etudes Economiste",
        "BEE -- Bureau d'Etudes Economiste",
    }

    @classmethod
    def est_meta_titre_legacy(cls, valeur):
        return (valeur or "").strip() in cls.meta_titres_legacy

    def to_internal_value(self, data):
        donnees = data.copy()
        for champ in self.champs_media:
            valeur = donnees.get(champ)
            if isinstance(valeur, str):
                donnees.pop(champ, None)
            elif valeur is not None and not isinstance(valeur, UploadedFile):
                donnees.pop(champ, None)
        return super().to_internal_value(donnees)

    def _fusionner_dictionnaires(self, base, surcharge):
        if not isinstance(base, dict) or not isinstance(surcharge, dict):
            return surcharge

        resultat = dict(base)
        for cle, valeur in surcharge.items():
            if isinstance(valeur, dict) and isinstance(resultat.get(cle), dict):
                resultat[cle] = self._fusionner_dictionnaires(resultat[cle], valeur)
            else:
                resultat[cle] = valeur
        return resultat

    def to_representation(self, instance):
        donnees = super().to_representation(instance)
        if self.est_meta_titre_legacy(donnees.get("meta_titre")):
            donnees["meta_titre"] = ""
        donnees["contenu_accueil"] = self._fusionner_dictionnaires(
            contenu_accueil_par_defaut(),
            donnees.get("contenu_accueil") or {},
        )
        donnees["contenus_pages"] = self._fusionner_dictionnaires(
            contenus_pages_par_defaut(),
            donnees.get("contenus_pages") or {},
        )
        return donnees

    def _decoder_json_si_necessaire(self, valeur, champ):
        if isinstance(valeur, str):
            try:
                return json.loads(valeur)
            except json.JSONDecodeError as exc:
                raise serializers.ValidationError(
                    f"Le champ « {champ} » doit contenir un JSON valide."
                ) from exc
        return valeur

    def validate_carousel_accueil(self, valeur):
        valeur = self._decoder_json_si_necessaire(valeur, "carousel_accueil")
        if not isinstance(valeur, list):
            raise serializers.ValidationError("Le carrousel doit être une liste.")
        return valeur

    def validate_contenu_accueil(self, valeur):
        valeur = self._decoder_json_si_necessaire(valeur, "contenu_accueil")
        if not isinstance(valeur, dict):
            raise serializers.ValidationError(
                "Le contenu d'accueil doit être un objet JSON."
            )
        return valeur

    def validate_contenus_pages(self, valeur):
        valeur = self._decoder_json_si_necessaire(valeur, "contenus_pages")
        if not isinstance(valeur, dict):
            raise serializers.ValidationError(
                "Les contenus de pages doivent être un objet JSON."
            )
        return valeur

    def validate(self, attrs):
        meta_titre = attrs.get("meta_titre")
        if isinstance(meta_titre, str) and self.est_meta_titre_legacy(meta_titre):
            attrs["meta_titre"] = ""
        return attrs

    class Meta:
        model = ConfigurationSite
        fields = [
            "nom_bureau", "slogan", "sigle", "description_courte",
            "logo", "logo_pied_de_page", "favicon",
            "titre_hero", "sous_titre_hero",
            "texte_cta_principal", "texte_cta_secondaire", "etiquette_hero",
            "courriel_contact", "telephone_contact", "adresse", "ville", "code_postal", "pays",
            "afficher_stats", "afficher_valeurs", "afficher_demarche",
            "afficher_realisations", "afficher_equipe", "afficher_contact",
            "texte_cta_bandeau", "texte_description_bandeau",
            "couleur_theme", "mode_theme_defaut", "police_principale",
            "activer_carrousel_accueil", "carousel_accueil", "contenu_accueil", "contenus_pages",
            "meta_titre", "meta_description", "mots_cles",
            "date_modification",
        ]
        read_only_fields = ["date_modification"]


class AccueilSerialiseur(serializers.Serializer):
    """Sérialiseur agrégé — retourne toutes les données de la page d'accueil en un seul appel."""
    configuration = ConfigurationSiteSerialiseur()
    prestations = PrestationResumeSerialiseur(many=True)
    statistiques = StatistiqueSiteSerialiseur(many=True)
    valeurs = ValeurSiteSerialiseur(many=True)
    demarche = EtapeDemarcheSerialiseur(many=True)
    realisations = serializers.ListField(default=list)


class RealisationSerialiseur(serializers.ModelSerializer):
    class Meta:
        model = Realisation
        fields = [
            "id", "projet", "titre", "description",
            "client", "lieu", "annee", "montant_travaux_ht",
            "image_principale", "tags",
            "est_publie", "ordre_affichage", "date_publication",
        ]
        read_only_fields = ["id"]


class RealisationResumeSerialiseur(serializers.ModelSerializer):
    class Meta:
        model = Realisation
        fields = ["id", "titre", "client", "lieu", "annee", "tags", "image_principale"]
        read_only_fields = ["id"]


class MembreEquipeSerialiseur(serializers.ModelSerializer):
    class Meta:
        model = MembreEquipe
        fields = [
            "id", "utilisateur", "prenom", "nom", "fonction",
            "biographie", "photo", "ordre_affichage", "est_publie",
        ]
        read_only_fields = ["id"]


class DemandeContactSerialiseur(serializers.ModelSerializer):
    sujet_libelle = serializers.CharField(source="get_sujet_display", read_only=True)

    class Meta:
        model = DemandeContact
        fields = [
            "id", "nom", "courriel", "telephone", "organisation",
            "sujet", "sujet_libelle", "message",
            "traitee", "date_reception", "adresse_ip",
        ]
        read_only_fields = [
            "id", "traitee", "date_reception", "adresse_ip", "sujet_libelle",
        ]


class ConfigurationRGPDSerialiseur(serializers.ModelSerializer):
    class Meta:
        model = ConfigurationRGPD
        fields = [
            "bandeau_actif", "texte_bandeau",
            "texte_bouton_accepter", "texte_bouton_refuser", "texte_bouton_personnaliser",
            "afficher_bouton_personnaliser", "duree_consentement_jours",
            "cookies_necessaires_description",
            "cookies_analytiques_actifs", "cookies_analytiques_description",
            "cookies_marketing_actifs", "cookies_marketing_description",
            "lien_politique_confidentialite", "lien_gestion_cookies",
        ]


class PageStatiqueSerialiseur(serializers.ModelSerializer):
    class Meta:
        model = PageStatique
        fields = [
            "id",
            "code",
            "type_page",
            "titre",
            "contenu",
            "est_publiee",
            "afficher_dans_pied_de_page",
            "date_modification",
        ]
        read_only_fields = ["id"]


class ActualiteSerialiseur(serializers.ModelSerializer):
    class Meta:
        model = Actualite
        fields = [
            "id", "slug", "titre", "extrait", "contenu",
            "image", "categorie", "tags", "etat",
            "date_publication", "date_creation",
        ]
        read_only_fields = ["id", "date_creation"]


class ActualiteResumeSerialiseur(serializers.ModelSerializer):
    class Meta:
        model = Actualite
        fields = ["id", "slug", "titre", "extrait", "image", "categorie", "date_publication"]
        read_only_fields = ["id"]
