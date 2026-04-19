"""
Classe de stockage personnalisée — Plateforme LBH.

Remplace l'URL interne MinIO (lbh-minio:9000) par l'URL publique
accessible depuis les navigateurs via le proxy nginx (/minio/).
"""

from storages.backends.s3boto3 import S3Boto3Storage
from django.conf import settings


class StockageMinioPublic(S3Boto3Storage):
    """
    Étend S3Boto3Storage pour réécrire les URLs de téléchargement.
    Le proxy nginx monte MinIO sur /minio/, ce qui préserve la validité
    des signatures S3 (la signature couvre le path, pas le hostname).
    """

    def url(self, name, parameters=None, expire=None, http_method=None):
        url_interne = super().url(name, parameters=parameters, expire=expire, http_method=http_method)
        return self._url_publique(url_interne)

    @staticmethod
    def _url_publique(url_interne: str) -> str:
        endpoint = getattr(settings, "AWS_S3_ENDPOINT_URL", "http://lbh-minio:9000")
        base_publique = getattr(settings, "MINIO_URL_PUBLIQUE", "/minio")
        if url_interne.startswith(endpoint):
            chemin = url_interne[len(endpoint):]
            # Normalise le slash
            return base_publique.rstrip("/") + "/" + chemin.lstrip("/")
        return url_interne
