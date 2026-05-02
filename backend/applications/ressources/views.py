"""Vues API pour la section Ressources."""

from decimal import Decimal

from rest_framework import generics, status
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response

from .models import (
    DevisAnalyse,
    EstimationSource,
    FicheRatioCout,
    IndiceRevisionPrix,
    LignePrixMarche,
    ModeleMappingDocumentPrix,
)
from .serialiseurs import (
    DevisAnalyseSerialiseur,
    EstimationSourceSerialiseur,
    FicheRatioCoutSerialiseur,
    IndiceRevisionPrixSerialiseur,
    LignePrixMarcheSerialiseur,
    ModeleMappingDocumentPrixSerialiseur,
)


def evaluer_ligne_capitalisable(ligne: LignePrixMarche) -> tuple[bool, str]:
    """Vérifie qu'une ligne extraite peut alimenter la bibliothèque de prix."""
    donnees_import = ligne.donnees_import or {}
    if ligne.type_ligne != "article":
        return False, "La ligne n'est pas un article de prix."
    if ligne.statut_controle in {"erreur", "ignoree"}:
        return False, "La ligne est marquée comme non exploitable."
    if not (ligne.designation or "").strip() or set((ligne.designation or "").strip()) <= {".", "-", "–", "—", "_"}:
        return False, "La désignation est vide ou décorative."
    if not (ligne.unite or "").strip():
        return False, "L'unité est absente."
    if not ligne.prix_ht_original or ligne.prix_ht_original <= 0:
        return False, "Le prix unitaire est absent."
    if ligne.score_confiance is not None and ligne.score_confiance < Decimal("0.55"):
        return False, "Le score de confiance est trop faible."
    if donnees_import.get("capitalisable") is False:
        return False, "La ligne doit être vérifiée avant capitalisation."
    if ligne.ecart_montant_ht and ligne.montant_ht:
        tolerance = max(Decimal("0.05"), abs(ligne.montant_ht) * Decimal("0.05"))
        if ligne.ecart_montant_ht > tolerance:
            return False, "Le triplet quantité / PU / montant est incohérent."
    return True, ""


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
    devis.message_analyse = ""
    devis.nb_lignes_detectees = 0
    devis.nb_lignes_rejetees = 0
    devis.nb_lignes_a_verifier = 0
    devis.score_qualite_extraction = 0
    devis.save(update_fields=[
        "statut", "erreur_detail", "message_analyse",
        "nb_lignes_detectees", "nb_lignes_rejetees",
        "nb_lignes_a_verifier", "score_qualite_extraction",
    ])
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


@api_view(["GET"])
def vue_texte_extrait_devis(request, pk):
    """Retourne le diagnostic et l'aperçu du texte extrait d'un devis."""
    devis = generics.get_object_or_404(DevisAnalyse, pk=pk)
    return Response({
        "id": str(devis.id),
        "nom_original": devis.nom_original,
        "statut": devis.statut,
        "message_analyse": devis.message_analyse or devis.erreur_detail,
        "methode_extraction": devis.methode_extraction,
        "nb_lignes_detectees": devis.nb_lignes_detectees,
        "nb_lignes_rejetees": devis.nb_lignes_rejetees,
        "nb_lignes_a_verifier": devis.nb_lignes_a_verifier,
        "score_qualite_extraction": devis.score_qualite_extraction,
        "texte_extrait_apercu": devis.texte_extrait_apercu,
        "donnees_extraction": devis.donnees_extraction,
    })


@api_view(["POST"])
def vue_mapping_manuel_devis(request, pk):
    """Importe des lignes de prix validées manuellement depuis l'interface de mapping."""
    from .services_mapping_document_prix import valider_mapping_document

    lignes = request.data.get("lignes") or []
    if not isinstance(lignes, list) or not lignes:
        return Response({"detail": "Aucune ligne de mapping à importer."}, status=status.HTTP_400_BAD_REQUEST)
    lignes_tableau = [[
        ligne.get("numero") or "",
        ligne.get("designation") or "",
        ligne.get("unite") or "",
        ligne.get("quantite") or "",
        ligne.get("prix_unitaire_ht") or ligne.get("prix_unitaire") or "",
        ligne.get("montant_ht") or "",
    ] for ligne in lignes if isinstance(ligne, dict)]
    mapping = {
        "lignes": lignes_tableau,
        "colonnes": {
            "numero": 0,
            "designation": 1,
            "unite": 2,
            "quantite": 3,
            "prix_unitaire_ht": 4,
            "montant_ht": 5,
        },
        "regles": {"premiere_ligne": 1, "ignorer_entetes": True, "ignorer_sous_totaux": True, "ignorer_totaux": True},
    }
    try:
        resultat = valider_mapping_document(pk, mapping, {"importer_corrigees": True})
    except Exception as exc:
        return Response({"detail": f"Import manuel impossible : {exc}"}, status=status.HTTP_400_BAD_REQUEST)
    return Response({"lignes_importees": resultat["lignes_importees"], "erreurs": resultat.get("ignorees", [])})


@api_view(["GET"])
def vue_mapping_preparer(request, pk):
    from .services_mapping_document_prix import preparer_mapping_document
    try:
        return Response(preparer_mapping_document(pk))
    except Exception as exc:
        return Response({"detail": f"Préparation du mapping impossible : {exc}"}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["POST"])
def vue_mapping_previsualiser(request, pk):
    from .services_mapping_document_prix import previsualiser_mapping_document
    try:
        return Response(previsualiser_mapping_document(pk, request.data or {}))
    except Exception as exc:
        return Response({"detail": f"Prévisualisation du mapping impossible : {exc}"}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["POST"])
def vue_mapping_valider(request, pk):
    from .services_mapping_document_prix import valider_mapping_document
    try:
        resultat = valider_mapping_document(pk, request.data.get("mapping") or request.data or {}, request.data.get("options") or {})
        return Response(resultat)
    except Exception as exc:
        return Response({"detail": f"Validation du mapping impossible : {exc}"}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["POST"])
def vue_mapping_sauvegarder_modele(request, pk):
    from .services_mapping_document_prix import sauvegarder_modele_mapping
    devis = generics.get_object_or_404(DevisAnalyse, pk=pk)
    payload = dict(request.data or {})
    payload.setdefault("type_document", devis.type_document)
    payload.setdefault("entreprise_source", devis.entreprise)
    try:
        modele = sauvegarder_modele_mapping(payload)
        return Response(ModeleMappingDocumentPrixSerialiseur(modele).data, status=status.HTTP_201_CREATED)
    except Exception as exc:
        return Response({"detail": f"Sauvegarde du modèle impossible : {exc}"}, status=status.HTTP_400_BAD_REQUEST)


class VueListeModelesMapping(generics.ListCreateAPIView):
    queryset = ModeleMappingDocumentPrix.objects.filter(est_actif=True)
    serializer_class = ModeleMappingDocumentPrixSerialiseur


@api_view(["POST"])
def vue_appliquer_modele_mapping(request, pk):
    from .services_mapping_document_prix import previsualiser_mapping_document
    modele = generics.get_object_or_404(ModeleMappingDocumentPrix, pk=pk, est_actif=True)
    devis_id = request.data.get("devis_id")
    if not devis_id:
        return Response({"detail": "Devis cible manquant."}, status=status.HTTP_400_BAD_REQUEST)
    mapping = {
        "colonnes": modele.colonnes_mapping,
        "regles": {**(modele.regles_nettoyage or {}), "separateur_description": modele.separateur_description},
    }
    try:
        return Response(previsualiser_mapping_document(devis_id, mapping))
    except Exception as exc:
        return Response({"detail": f"Application du modèle impossible : {exc}"}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["POST"])
def vue_capitaliser_devis(request, pk):
    """Capitalise toutes les lignes d'un devis en bibliothèque."""
    from .services import capitaliser_ligne_en_bibliotheque
    devis = generics.get_object_or_404(DevisAnalyse, pk=pk)
    if not LignePrixMarche.objects.filter(devis_source=devis).exists():
        return Response(
            {"detail": "Aucune ligne à capitaliser. Lancez une nouvelle analyse ou effectuez un mapping manuel."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    lignes = LignePrixMarche.objects.filter(devis_source=devis, ligne_bibliotheque__isnull=True)
    nb = 0
    erreurs = []
    ignorees = []
    for ligne in lignes:
        capitalisable, raison = evaluer_ligne_capitalisable(ligne)
        if not capitalisable:
            ignorees.append({"id": str(ligne.id), "designation": ligne.designation, "raison": raison})
            continue
        try:
            capitaliser_ligne_en_bibliotheque(ligne)
            nb += 1
        except Exception as exc:
            erreurs.append(str(exc))
    if nb > 0:
        devis.capitalise = True
        devis.save(update_fields=["capitalise"])
    if nb == 0 and ignorees:
        return Response(
            {
                "detail": "Aucune ligne capitalisable. Corrigez les lignes à vérifier avant capitalisation.",
                "capitalise": nb,
                "ignorees": ignorees,
                "erreurs": erreurs,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )
    return Response({"capitalise": nb, "ignorees": ignorees, "erreurs": erreurs})


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
    capitalisable, raison = evaluer_ligne_capitalisable(ligne)
    if not capitalisable:
        return Response({"detail": raison}, status=status.HTTP_400_BAD_REQUEST)
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
