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
    from decimal import Decimal, InvalidOperation
    from .services import detecter_corps_etat, estimer_sdp_depuis_prix, normaliser_designation, tronquer_champ

    devis = generics.get_object_or_404(DevisAnalyse, pk=pk)
    lignes = request.data.get("lignes") or []
    if not isinstance(lignes, list) or not lignes:
        return Response({"detail": "Aucune ligne de mapping à importer."}, status=status.HTTP_400_BAD_REQUEST)

    creees = 0
    erreurs = []
    for index, ligne in enumerate(lignes, start=1):
        designation = str(ligne.get("designation") or "").strip()
        if not designation:
            erreurs.append(f"Ligne {index} : désignation manquante.")
            continue
        try:
            quantite = Decimal(str(ligne.get("quantite") or "1").replace(",", "."))
            prix_unitaire = Decimal(str(ligne.get("prix_unitaire_ht") or ligne.get("prix_unitaire") or "0").replace(",", "."))
            montant = Decimal(str(ligne.get("montant_ht") or "0").replace(",", "."))
        except (InvalidOperation, TypeError):
            erreurs.append(f"Ligne {index} : valeur numérique invalide.")
            continue
        if prix_unitaire <= 0 and montant > 0 and quantite > 0:
            prix_unitaire = (montant / quantite).quantize(Decimal("0.0001"))
        if prix_unitaire <= 0:
            erreurs.append(f"Ligne {index} : prix unitaire manquant.")
            continue

        corps_code, corps_libelle = detecter_corps_etat(designation)
        sdp = estimer_sdp_depuis_prix(prix_unitaire, corps_libelle)
        designation_courte = tronquer_champ(designation, 500)
        LignePrixMarche.objects.create(
            devis_source=devis,
            ordre=int(ligne.get("ordre") or index),
            numero=str(ligne.get("numero") or ""),
            designation=designation_courte,
            designation_originale=str(ligne.get("designation_originale") or designation),
            designation_normalisee=tronquer_champ(normaliser_designation(designation), 500),
            unite=str(ligne.get("unite") or "U"),
            quantite=quantite,
            prix_ht_original=prix_unitaire,
            montant_ht=montant if montant > 0 else (quantite * prix_unitaire).quantize(Decimal("0.01")),
            montant_recalcule_ht=(quantite * prix_unitaire).quantize(Decimal("0.01")),
            ecart_montant_ht=abs(((quantite * prix_unitaire).quantize(Decimal("0.01"))) - montant) if montant > 0 else Decimal("0"),
            type_ligne="article",
            statut_controle="corrigee",
            score_confiance=Decimal("0.90"),
            corrections_proposees=["Ligne créée par mapping manuel."],
            donnees_import={"methode_extraction": "mapping_manuel"},
            decision_import="importer",
            indice_code=devis.indice_base_code or "BT01",
            indice_valeur_base=devis.indice_base_valeur,
            localite=devis.localite or "",
            corps_etat=corps_code,
            corps_etat_libelle=corps_libelle,
            debourse_sec_estime=sdp.get("debourse_sec"),
            kpv_estime=sdp.get("kpv"),
            pct_mo_estime=sdp.get("pct_mo"),
            pct_materiaux_estime=sdp.get("pct_materiaux"),
            pct_materiel_estime=sdp.get("pct_materiel"),
        )
        creees += 1

    if creees:
        devis.statut = "termine"
        devis.erreur_detail = ""
        devis.message_analyse = f"{creees} ligne(s) importée(s) par mapping manuel."
        devis.nb_lignes_detectees = devis.lignes.count()
        devis.methode_extraction = "mapping_manuel"
        devis.save(update_fields=[
            "statut", "erreur_detail", "message_analyse",
            "nb_lignes_detectees", "methode_extraction",
        ])
    return Response({"lignes_importees": creees, "erreurs": erreurs})


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
    for ligne in lignes:
        try:
            capitaliser_ligne_en_bibliotheque(ligne)
            nb += 1
        except Exception as exc:
            erreurs.append(str(exc))
    if nb > 0:
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
