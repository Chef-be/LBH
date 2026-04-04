from django.apps import AppConfig


class PiecesEcritesConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'applications.pieces_ecrites'

    def ready(self):
        from . import signals  # noqa: F401
