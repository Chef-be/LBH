"""Vues API pour la section Ressources."""

from rest_framework import generics, status
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response

from .models import DevisAnalyse, EstimationSource, FicheRatioCout, IndiceRevisionPrix, LignePrixMarche
from .serialiseurs import (
    DevisAnalyseSerialiseur,
    EstimationSourceSerialiseur,
    FicheRatioCoutSerialiseur,
    IndiceRevisionPrixSerialiseur,
    LignePrixMarcheSerialiseur,
)


# ---------------------------------------------------------------------------
# Indices BT/TP
# ---------------------------------------------------------------------------


class VueListeIndices(generics.ListCreateAPIView):
    queryset = IndiceRevisionPrix.objects.all()
    serializer_class = IndiceRevisionPrixSerialiseur

    def get_queryset(self):
        qs = super().get_queryset()
        code = self.request.query_params.get("code")
        if code:
            qs = qs.filter(code=code)
        return qs


class VueDetailIndice(generics.RetrieveUpdateDestroyAPIView):
    queryset = IndiceRevisionPrix.objects.all()
    serializer_class = IndiceRevisionPrixSerialiseur


@api_view(["POST"])
def vue_recuperer_indices_insee(request):
    """
    Déclenche la récupération automatique des indices BT/TP depuis l'API INSEE.
    Peut recevoir une liste de codes optionnelle (par défaut tous).
    """
    from .services import recuperer_indices_insee
    codes = request.data.get("codes") or None
    resultats = recuperer_indices_insee(codes)
    total_crees = sum(v.get("crees", 0) for v in resultats.values())
    return Response({
        "detail": f"{total_crees} valeur(s) créée(s) depuis l'INSEE.",
        "resultats": resultats,
    })


@api_view(["POST"])
@parser_classes([MultiPartParser, FormParser])
def vue_actualiser_montant_devis(request):
    """
    Analyse un PDF de devis et calcule le montant actualisé selon l'indice courant.
    Corps multipart : fichier, indice_code, indice_base_valeur (optionnel), methode (optionnel).
    """
    from .services import actualiser_montant_depuis_devis
    from decimal import Decimal, InvalidOperation

    fichier = request.FILES.get("fichier")
    if not fichier:
        return Response({"detail": "Fichier manquant."}, status=status.HTTP_400_BAD_REQUEST)
    if fichier.size > 20 * 1024 * 1024:
        return Response({"detail": "Fichier trop volumineux (max 20 Mo)."}, status=status.HTTP_400_BAD_REQUEST)

    indice_code = request.data.get("indice_code", "BT01")
    methode = request.data.get("methode", "ccag")

    try:
        indice_base = Decimal(str(request.data.get("indice_base_valeur", ""))) if request.data.get("indice_base_valeur") else None
    except InvalidOperation:
        indice_base = None

    contenu = fichier.read()
    resultat = actualiser_montant_depuis_devis(contenu, fichier.name, indice_code, indice_base, methode)
    return Response(resultat)


@api_view(["GET"])
def vue_indices_courants(request):
    """Retourne la dernière valeur pour chaque code d'indice."""
    from django.db.models import Max
    codes = IndiceRevisionPrix.objects.values_list("code", flat=True).distinct()
    result = []
    for code in codes:
        dernier = IndiceRevisionPrix.objects.filter(code=code).order_by("-date_publication").first()
        if dernier:
            result.append(IndiceRevisionPrixSerialiseur(dernier).data)
    return Response(result)


# ---------------------------------------------------------------------------
# Devis analysés
# ---------------------------------------------------------------------------


class VueListeDevis(generics.ListCreateAPIView):
    queryset = DevisAnalyse.objects.all()
    serializer_class = DevisAnalyseSerialiseur
    parser_classes = [MultiPartParser, FormParser]

    def perform_create(self, serializer):
        fichier = self.request.FILES.get("fichier")
        nom_original = fichier.name if fichier else "document"
        instance = serializer.save(nom_original=nom_original)
        # Lancer l'analyse en tâche de fond
        try:
            from .taches import tache_analyser_devis
            tache_analyser_devis.delay(str(instance.id))
        except Exception:
            pass


class VueDetailDevis(generics.RetrieveUpdateDestroyAPIView):
    queryset = DevisAnalyse.objects.all()
    serializer_class = DevisAnalyseSerialiseur


@api_view(["POST"])
@parser_classes([MultiPartParser, FormParser])
def vue_previsualiser_devis(request):
    """
    Analyse rapidement un fichier PDF pour en extraire les métadonnées suggérées
    (entreprise, localité, date, type de document, indice BT dominant).
    Ne crée aucun enregistrement en base — utilisé pour pré-remplir le formulaire.
    """
    from .services import previsualiser_devis_depuis_fichier

    fichier = request.FILES.get("fichier")
    if not fichier:
        return Response({"detail": "Fichier manquant."}, status=status.HTTP_400_BAD_REQUEST)

    # Lire les octets en mémoire (limité à 20 Mo)
    if fichier.size > 20 * 1024 * 1024:
        return Response({"detail": "Fichier trop volumineux (max 20 Mo)."}, status=status.HTTP_400_BAD_REQUEST)

    contenu = fichier.read()
    metadonnees = previsualiser_devis_depuis_fichier(contenu, fichier.name)
    return Response(metadonnees)


@api_view(["POST"])
def vue_relancer_analyse(request, pk):
    """Relance l'analyse d'un devis."""
    devis = generics.get_object_or_404(DevisAnalyse, pk=pk)
    devis.statut = "en_attente"
    devis.erreur_detail = ""
    devis.save(update_fields=["statut", "erreur_detail"])
    try:
        from .taches import tache_analyser_devis
        tache_analyser_devis.delay(str(devis.id))
    except Exception:
        pass
    return Response({"detail": "Analyse relancée."})


@api_view(["GET"])
def vue_lignes_devis(request, pk):
    """Retourne les lignes extraites d'un devis."""
    devis = generics.get_object_or_404(DevisAnalyse, pk=pk)
    lignes = LignePrixMarche.objects.filter(devis_source=devis).order_by("date_creation")
    serialiseur = LignePrixMarcheSerialiseur(lignes, many=True, context={"request": request})
    return Response(serialiseur.data)


@api_view(["POST"])
def vue_capitaliser_devis(request, pk):
    """Capitalise toutes les lignes d'un devis en bibliothèque."""
    from .services import capitaliser_ligne_en_bibliotheque
    devis = generics.get_object_or_404(DevisAnalyse, pk=pk)
    lignes = LignePrixMarche.objects.filter(devis_source=devis, ligne_bibliotheque__isnull=True)
    nb = 0
    erreurs = []
    for ligne in lignes:
        try:
            capitaliser_ligne_en_bibliotheque(ligne)
            nb += 1
        except Exception as exc:
            erreurs.append(str(exc))
    devis.capitalise = True
    devis.save(update_fields=["capitalise"])
    return Response({"capitalise": nb, "erreurs": erreurs})


@api_view(["DELETE"])
def vue_vider_devis_expires(request):
    """Supprime les devis dont la date de suppression programmée est dépassée."""
    from django.utils import timezone
    supprimes = DevisAnalyse.objects.filter(date_suppression_programmee__lt=timezone.now().date())
    nb = supprimes.count()
    supprimes.delete()
    return Response({"supprime": nb})


# ---------------------------------------------------------------------------
# Banque de prix marché
# ---------------------------------------------------------------------------


class VueListePrixMarche(generics.ListAPIView):
    queryset = LignePrixMarche.objects.all()
    serializer_class = LignePrixMarcheSerialiseur

    def get_queryset(self):
        qs = super().get_queryset()
        localite = self.request.query_params.get("localite")
        corps_etat = self.request.query_params.get("corps_etat")
        recherche = self.request.query_params.get("search")
        if localite:
            qs = qs.filter(localite__icontains=localite)
        if corps_etat:
            qs = qs.filter(corps_etat=corps_etat)
        if recherche:
            qs = qs.filter(designation__icontains=recherche)
        return qs


class VueDetailPrixMarche(generics.RetrieveUpdateDestroyAPIView):
    queryset = LignePrixMarche.objects.all()
    serializer_class = LignePrixMarcheSerialiseur


@api_view(["POST"])
def vue_capitaliser_ligne(request, pk):
    """Capitalise une ligne de prix marché en bibliothèque."""
    from .services import capitaliser_ligne_en_bibliotheque
    ligne = generics.get_object_or_404(LignePrixMarche, pk=pk)
    try:
        ligne_bib = capitaliser_ligne_en_bibliotheque(ligne)
        return Response({"detail": "Capitalisé.", "ligne_bibliotheque_id": str(ligne_bib.id)})
    except Exception as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["POST"])
def vue_actualiser_prix(request):
    """Actualise tous les prix marché avec l'indice courant."""
    from .services import actualiser_toutes_les_lignes
    code = request.data.get("code_indice", "BT01")
    nb = actualiser_toutes_les_lignes(code)
    return Response({"detail": f"{nb} ligne(s) actualisée(s)."})


# ---------------------------------------------------------------------------
# Estimations et fiches ratio
# ---------------------------------------------------------------------------


class VueListeEstimations(generics.ListCreateAPIView):
    queryset = EstimationSource.objects.all()
    serializer_class = EstimationSourceSerialiseur
    parser_classes = [MultiPartParser, FormParser]

    def perform_create(self, serializer):
        fichier = self.request.FILES.get("fichier")
        nom_original = fichier.name if fichier else "document"
        instance = serializer.save(nom_original=nom_original)
        try:
            from .taches import tache_analyser_estimation
            tache_analyser_estimation.delay(str(instance.id))
        except Exception:
            pass


class VueDetailEstimation(generics.RetrieveUpdateDestroyAPIView):
    queryset = EstimationSource.objects.all()
    serializer_class = EstimationSourceSerialiseur


class VueListeFichesRatio(generics.ListCreateAPIView):
    queryset = FicheRatioCout.objects.all()
    serializer_class = FicheRatioCoutSerialiseur

    def get_queryset(self):
        qs = super().get_queryset()
        type_projet = self.request.query_params.get("type_projet")
        localite = self.request.query_params.get("localite")
        if type_projet:
            qs = qs.filter(type_projet=type_projet)
        if localite:
            qs = qs.filter(localite__icontains=localite)
        return qs


class VueDetailFicheRatio(generics.RetrieveUpdateDestroyAPIView):
    queryset = FicheRatioCout.objects.all()
    serializer_class = FicheRatioCoutSerialiseur


@api_view(["GET"])
def vue_ratios_reference(request):
    """Retourne les ratios de référence par type de projet (moyennes du marché 2025)."""
    RATIOS_REF = {
        "logement_collectif": {"min": 1180, "max": 1400, "moyenne": 1290, "unite": "€/m² SHON"},
        "logement_individuel": {"min": 1400, "max": 2200, "moyenne": 1700, "unite": "€/m² SHON"},
        "bureaux": {"min": 1500, "max": 3000, "moyenne": 2100, "unite": "€/m² SHON"},
        "equipement_scolaire": {"min": 1800, "max": 2800, "moyenne": 2200, "unite": "€/m² SHON"},
        "equipement_sportif": {"min": 1200, "max": 2500, "moyenne": 1700, "unite": "€/m² SHON"},
        "equipement_culturel": {"min": 2000, "max": 4000, "moyenne": 2800, "unite": "€/m² SHON"},
        "commerce": {"min": 800, "max": 2000, "moyenne": 1300, "unite": "€/m² SHON"},
        "industrie": {"min": 400, "max": 1200, "moyenne": 700, "unite": "€/m² SHON"},
        "sante": {"min": 2500, "max": 5000, "moyenne": 3500, "unite": "€/m² SHON"},
    }
    # Compléments par type de fondation (facteur multiplicateur)
    FACTEURS_FONDATION = {
        "superficielle_semelle": {"facteur": 1.00, "note": "Référence (semelles superficielles)"},
        "superficielle_radier": {"facteur": 1.05, "note": "+5% — radier général"},
        "profonde_pieux_beton": {"facteur": 1.20, "note": "+20% — pieux béton forés"},
        "profonde_pieux_metalliques": {"facteur": 1.25, "note": "+25% — pieux métalliques"},
        "profonde_micropieux": {"facteur": 1.35, "note": "+35% — micropieux (terrain difficile)"},
        "profonde_paroi_moulee": {"facteur": 1.50, "note": "+50% — paroi moulée (sous-sol profond)"},
    }
    return Response({"ratios": RATIOS_REF, "facteurs_fondation": FACTEURS_FONDATION})
