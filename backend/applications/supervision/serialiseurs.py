"""Sérialiseurs pour la supervision — Plateforme LBH."""

from rest_framework import serializers
from .models import (
    EvenementSysteme,
    MetriqueService,
    AlerteSupervision,
    InstantaneServeur,
    ServeurMail,
)


class EvenementSystemeSerialiseur(serializers.ModelSerializer):
    niveau_libelle = serializers.CharField(source="get_niveau_display", read_only=True)
    categorie_libelle = serializers.CharField(source="get_categorie_display", read_only=True)
    utilisateur_nom = serializers.SerializerMethodField()

    class Meta:
        model = EvenementSysteme
        fields = [
            "id", "niveau", "niveau_libelle", "categorie", "categorie_libelle",
            "message", "details", "source", "adresse_ip",
            "utilisateur", "utilisateur_nom",
            "date_evenement", "resolu", "date_resolution",
        ]
        read_only_fields = fields

    def get_utilisateur_nom(self, obj):
        if obj.utilisateur:
            return f"{obj.utilisateur.prenom} {obj.utilisateur.nom}"
        return None


class MetriqueServiceSerialiseur(serializers.ModelSerializer):
    service_libelle = serializers.CharField(source="get_service_display", read_only=True)

    class Meta:
        model = MetriqueService
        fields = [
            "id", "service", "service_libelle",
            "disponible", "temps_reponse_ms",
            "charge_cpu_pct", "memoire_pct",
            "details", "horodatage",
        ]
        read_only_fields = fields


class AlerteSupervisionSerialiseur(serializers.ModelSerializer):
    type_libelle = serializers.CharField(source="get_type_alerte_display", read_only=True)
    niveau_libelle = serializers.CharField(source="get_niveau_display", read_only=True)
    acquittee_par_nom = serializers.SerializerMethodField()

    class Meta:
        model = AlerteSupervision
        fields = [
            "id", "type_alerte", "type_libelle",
            "niveau", "niveau_libelle",
            "titre", "description", "service_concerne",
            "est_active", "date_declenchement", "date_resolution",
            "acquittee_par", "acquittee_par_nom",
        ]
        read_only_fields = [
            f for f in fields
            if f not in ("est_active", "acquittee_par")
        ]

    def get_acquittee_par_nom(self, obj):
        if obj.acquittee_par:
            return f"{obj.acquittee_par.prenom} {obj.acquittee_par.nom}"
        return None


class InstantaneServeurSerialiseur(serializers.ModelSerializer):
    class Meta:
        model = InstantaneServeur
        fields = [
            "id",
            "charge_cpu_pct",
            "memoire_pct",
            "disque_pct",
            "charge_moyenne_1m",
            "charge_moyenne_5m",
            "charge_moyenne_15m",
            "memoire_totale_octets",
            "memoire_utilisee_octets",
            "disque_total_octets",
            "disque_utilise_octets",
            "details",
            "horodatage",
        ]
        read_only_fields = fields


class ServeurMailSerialiseur(serializers.ModelSerializer):
    chiffrement_libelle = serializers.CharField(source="get_chiffrement_display", read_only=True)
    imap_chiffrement_libelle = serializers.CharField(source="get_imap_chiffrement_display", read_only=True)
    modifie_par_nom = serializers.SerializerMethodField()
    mot_de_passe = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
        trim_whitespace=False,
    )
    imap_mot_de_passe = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
        trim_whitespace=False,
    )
    mot_de_passe_defini = serializers.SerializerMethodField()
    imap_mot_de_passe_defini = serializers.SerializerMethodField()

    class Meta:
        model = ServeurMail
        fields = [
            "id",
            "nom",
            "hote",
            "port",
            "chiffrement",
            "chiffrement_libelle",
            "utilisateur",
            "mot_de_passe",
            "mot_de_passe_defini",
            "imap_hote",
            "imap_port",
            "imap_chiffrement",
            "imap_chiffrement_libelle",
            "imap_utilisateur",
            "imap_mot_de_passe",
            "imap_mot_de_passe_defini",
            "imap_verifier_certificat",
            "imap_dossier_envoyes",
            "imap_dossier_brouillons",
            "imap_dossier_archives",
            "imap_dossier_indesirables",
            "imap_dossier_corbeille",
            "expediteur_defaut",
            "reponse_a",
            "delai_connexion",
            "verifier_certificat",
            "usage_envoi_plateforme",
            "usage_notifications",
            "est_actif",
            "est_defaut",
            "notes",
            "date_creation",
            "date_modification",
            "modifie_par",
            "modifie_par_nom",
        ]
        read_only_fields = [
            "id",
            "chiffrement_libelle",
            "imap_chiffrement_libelle",
            "mot_de_passe_defini",
            "imap_mot_de_passe_defini",
            "date_creation",
            "date_modification",
            "modifie_par",
            "modifie_par_nom",
        ]

    def get_modifie_par_nom(self, obj):
        if obj.modifie_par:
            return f"{obj.modifie_par.prenom} {obj.modifie_par.nom}"
        return None

    def get_mot_de_passe_defini(self, obj):
        return bool(obj.mot_de_passe)

    def get_imap_mot_de_passe_defini(self, obj):
        return bool(obj.imap_mot_de_passe)

    def validate(self, attrs):
        chiffrement = attrs.get("chiffrement", getattr(self.instance, "chiffrement", "starttls"))
        port = attrs.get("port", getattr(self.instance, "port", 587))
        imap_hote = attrs.get("imap_hote", getattr(self.instance, "imap_hote", ""))
        imap_chiffrement = attrs.get(
            "imap_chiffrement",
            getattr(self.instance, "imap_chiffrement", "ssl_tls"),
        )
        imap_port = attrs.get("imap_port", getattr(self.instance, "imap_port", 993))
        est_actif = attrs.get("est_actif", getattr(self.instance, "est_actif", True))
        est_defaut = attrs.get("est_defaut", getattr(self.instance, "est_defaut", False))
        verifier_certificat = attrs.get(
            "verifier_certificat",
            getattr(self.instance, "verifier_certificat", True),
        )
        imap_verifier_certificat = attrs.get(
            "imap_verifier_certificat",
            getattr(self.instance, "imap_verifier_certificat", True),
        )
        if chiffrement == "ssl_tls" and port == 587:
            attrs["port"] = 465
        if chiffrement == "aucun" and verifier_certificat:
            attrs["verifier_certificat"] = False
        if imap_hote:
            if imap_chiffrement == "ssl_tls" and imap_port == 143:
                attrs["imap_port"] = 993
            if imap_chiffrement == "aucun" and imap_verifier_certificat:
                attrs["imap_verifier_certificat"] = False
        if not est_actif and est_defaut:
            attrs["est_defaut"] = False
        return attrs

    def update(self, instance, validated_data):
        mot_de_passe = validated_data.pop("mot_de_passe", None)
        imap_mot_de_passe = validated_data.pop("imap_mot_de_passe", None)
        for champ, valeur in validated_data.items():
            setattr(instance, champ, valeur)
        if mot_de_passe is not None and mot_de_passe != "":
            instance.mot_de_passe = mot_de_passe
        if imap_mot_de_passe is not None and imap_mot_de_passe != "":
            instance.imap_mot_de_passe = imap_mot_de_passe
        instance.save()
        return instance

    def create(self, validated_data):
        return ServeurMail.objects.create(**validated_data)
