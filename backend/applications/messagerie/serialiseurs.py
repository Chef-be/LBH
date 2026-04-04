"""Sérialiseurs de messagerie et de journalisation."""

from rest_framework import serializers

from applications.messagerie.models import JournalCourriel
from applications.supervision.serialiseurs import ServeurMailSerialiseur


class ServeurMessagerieSerialiseur(ServeurMailSerialiseur):
    class Meta(ServeurMailSerialiseur.Meta):
        fields = ServeurMailSerialiseur.Meta.fields
        read_only_fields = ServeurMailSerialiseur.Meta.read_only_fields


class JournalCourrielSerialiseur(serializers.ModelSerializer):
    utilisateur_nom = serializers.CharField(source="utilisateur.nom_complet", read_only=True)

    class Meta:
        model = JournalCourriel
        fields = [
            "id",
            "origine",
            "statut",
            "sujet",
            "expediteur",
            "destinataires",
            "copie",
            "copie_cachee",
            "message_id",
            "erreur",
            "contexte",
            "nombre_pieces_jointes",
            "date_envoi",
            "utilisateur_nom",
        ]
