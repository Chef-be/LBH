"""Moteur adaptatif d'import des lignes de prix depuis documents BTP."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
from typing import Iterable


UNITES = (
    "ft/ml", "fft", "forf", "ens", "ml", "m2", "m3", "m²", "m³", "kg", "ut",
    "u", "m", "t", "f", "ft", "%",
)

RE_UNITE = re.compile(
    r"(?<![A-Za-zÀ-ÿ0-9])("
    + "|".join(re.escape(u) for u in sorted(UNITES, key=len, reverse=True))
    + r")(?![A-Za-zÀ-ÿ0-9])",
    re.IGNORECASE,
)
RE_NOMBRE = re.compile(r"\d{1,3}(?:[ \u00a0]\d{3})+(?:[,.]\d+)?(?!\d)|\d+[,.]\d+|\d+")
RE_MONTANT_FRAGMENT = re.compile(r"^(?:\d{1,3}(?:[ \u00a0]\d{3})+|\d+)(?:[,.]\d+)?\s*€$")
RE_POURCENTAGE_FRAGMENT = re.compile(r"^\d+(?:[,.]\d+)?%$")
RE_FRAGMENT_NUMERIQUE = re.compile(r"^(?:€|\d+(?:[,.]\d+)?|(?:\d{1,3}[ \u00a0])+\d{3}(?:[,.]\d+)?|[\d\s\u00a0,.]+€|\d+(?:[,.]\d+)?%)$")
RE_NUMERO_SEUL = re.compile(r"^\s*((?:\d+[,.])+\d+|\d+[A-Za-z]?|[A-Za-z])\s*$")
RE_NUMERO_DEBUT = re.compile(r"^\s*((?:\d+[,.])+\d+|\d+[A-Za-z]?|[A-Za-z])(?:\s+|$)(.*)$")
RE_SOUS_ARTICLE = re.compile(r"^(.*?)(?:\s+|^)([a-z])\s*[_\-–—]?\s*(.+)$", re.IGNORECASE)

MOTS_TOTAL = ("total", "sous-total", "sous total", "montant total", "total ht", "total h.t")
MOTS_ENTETE = (
    "désignation", "designation", "prix unitaire", "prix total", "quantité",
    "quantite", "somme h.t", "total ht", "n°", "unité", "unite",
)
MOTS_DESIGNATION_METIER = {
    "installation", "chantier", "démolition", "demolition", "déblais", "deblais",
    "remblai", "béton", "beton", "coffrage", "ferraillage", "purge",
    "nettoyage", "traitement", "évacuation", "evacuation", "terrassement",
    "canalisation", "bordure", "dalle", "radier", "voile", "enduit",
    "peinture", "fourniture", "pose", "étude", "etude", "contrôle",
    "controle", "laboratoire", "suivi", "géotechnique", "geotechnique",
    "divers", "propreté", "proprete", "ouvrage", "ouvrages",
}
MOTS_DESIGNATION_FAIBLES = {"brute", "net", "total", "poste"}


@dataclass
class LigneCandidate:
    numero: str = ""
    designation: str = ""
    unite: str = ""
    quantite: Decimal | None = None
    prix_unitaire_ht: Decimal | None = None
    montant_ht: Decimal | None = None
    montant_recalcule_ht: Decimal | None = None
    ecart_montant_ht: Decimal | None = None
    designation_originale: str = ""
    fragments_supprimes: list[str] = field(default_factory=list)
    nettoyage_designation: bool = False
    type_ligne: str = "article"
    statut_controle: str = "ok"
    score_confiance: Decimal = Decimal("0.80")
    corrections_proposees: list[str] = field(default_factory=list)


def normaliser_unite(unite: str) -> str:
    valeur = (unite or "").strip()
    table = {
        "m2": "m²",
        "m3": "m³",
        "forf": "Fft",
        "fft": "Fft",
        "f": "F",
        "ft": "Ft",
        "ft/ml": "Ft/ml",
        "ut": "U",
        "u": "U",
    }
    return table.get(valeur.lower(), valeur)


def convertir_decimal(valeur: str | Decimal | int | float | None) -> Decimal | None:
    if valeur is None:
        return None
    if isinstance(valeur, Decimal):
        return valeur
    texte = str(valeur).strip().replace("\u00a0", " ").replace("€", "")
    texte = re.sub(r"\s+", "", texte)
    if not texte:
        return None
    texte = texte.replace(",", ".")
    try:
        return Decimal(texte)
    except InvalidOperation:
        return None


def nettoyer_ligne(texte: str) -> str:
    texte = (texte or "").replace("\u00a0", " ")
    texte = re.sub(r"\s+", " ", texte)
    return texte.strip(" \t|;")


def _tokens_avec_positions(texte: str) -> list[tuple[str, int, int]]:
    return [(m.group(0), m.start(), m.end()) for m in re.finditer(r"\S+", texte or "")]


def _est_fragment_colonne(token: str) -> bool:
    propre = token.strip(" ;|")
    if not propre:
        return True
    return bool(RE_FRAGMENT_NUMERIQUE.match(propre))


def _est_debut_designation_credible(token: str) -> bool:
    propre = token.strip(" :;|,")
    if not propre or propre.startswith("€"):
        return False
    if _est_fragment_colonne(propre):
        return False
    if not re.search(r"[A-Za-zÀ-ÿ]", propre):
        return False
    mot = propre.lower()
    mot_alpha = re.sub(r"[^A-Za-zÀ-ÿ]", "", mot)
    return len(mot_alpha) > 3 or mot in MOTS_DESIGNATION_METIER


def detecter_debut_designation_metier(texte: str) -> int:
    """Retourne l'index probable du premier mot métier utile dans une désignation brute."""
    propre = nettoyer_ligne(texte)
    tokens = _tokens_avec_positions(propre)
    if not tokens:
        return 0

    candidats: list[tuple[int, int, int]] = []
    for index, (token, debut, _fin) in enumerate(tokens):
        if not _est_debut_designation_credible(token):
            continue
        avant = tokens[:index]
        fragments_avant = sum(1 for t, _d, _f in avant if _est_fragment_colonne(t))
        euros_avant = sum(1 for t, _d, _f in avant if "€" in t or t == "€")
        pourcentages_avant = sum(1 for t, _d, _f in avant if RE_POURCENTAGE_FRAGMENT.match(t.strip()))
        mot = re.sub(r"[^A-Za-zÀ-ÿ]", "", token.lower())
        score = 10
        if mot in MOTS_DESIGNATION_METIER:
            score += 12
        if fragments_avant:
            score += min(18, fragments_avant * 3)
        if euros_avant or pourcentages_avant:
            score += 16
        if index == 0:
            score += 4
        candidats.append((score, -index, debut))

    if not candidats:
        return 0
    return max(candidats)[2]


def nettoyer_designation_prix_extraite(texte: str) -> tuple[str, list[str]]:
    """Retire les fragments de colonnes qui précèdent le libellé métier."""
    brut = nettoyer_ligne(texte)
    if not brut:
        return "", []

    debut = detecter_debut_designation_metier(brut)
    fragments: list[str] = []
    nettoye = brut[debut:].strip(" -–—:;|")
    prefixe = brut[:debut].strip()
    if prefixe:
        fragments.extend(t for t, _d, _f in _tokens_avec_positions(prefixe))

    # Cas PDF fréquent : ancien libellé ou valeurs, puis montants, puis vrai libellé.
    tokens = _tokens_avec_positions(nettoye)
    dernier_fragment_fin = -1
    nb_fragments = 0
    for token, _debut, fin in tokens:
        if _est_fragment_colonne(token):
            dernier_fragment_fin = fin
            nb_fragments += 1
    if nb_fragments >= 3 and 0 <= dernier_fragment_fin < len(nettoye):
        apres = nettoye[dernier_fragment_fin:].strip(" -–—:;|")
        if _est_debut_designation_credible(apres.split(" ", 1)[0] if apres else ""):
            fragments.extend(t for t, _d, _f in tokens if _f <= dernier_fragment_fin)
            nettoye = apres

    nettoye = re.sub(r"^(?:€|\d+(?:[,.]\d+)?%?|\d[\d \u00a0,.]*€)\s+", "", nettoye).strip(" -–—:;|")
    nettoye = re.sub(r"\s+", " ", nettoye)
    return nettoye, fragments


def valider_designation_extraite(designation: str) -> tuple[bool, list[str]]:
    propre = nettoyer_ligne(designation)
    alertes: list[str] = []
    if not propre or len(propre) < 5:
        alertes.append("Désignation trop courte.")
    if propre.startswith("€"):
        alertes.append("Désignation commençant par un symbole monétaire.")
    if RE_MONTANT_FRAGMENT.match(propre.split(" ", 1)[0] if propre else ""):
        alertes.append("Désignation commençant par un montant.")
    if RE_POURCENTAGE_FRAGMENT.match(propre.split(" ", 1)[0] if propre else ""):
        alertes.append("Désignation commençant par un pourcentage.")
    if propre.lower() in MOTS_DESIGNATION_FAIBLES:
        alertes.append("Désignation métier insuffisante.")
    caracteres = [c for c in propre if not c.isspace()]
    if caracteres:
        ratio_numerique = sum(1 for c in caracteres if c.isdigit()) / len(caracteres)
        if ratio_numerique > 0.40:
            alertes.append("Désignation contenant trop de caractères numériques.")
    if len(re.findall(r"\d[\d \u00a0,.]*\s*€", propre)) > 2:
        alertes.append("Désignation contenant plusieurs montants.")
    premier_mot_match = re.search(r"[A-Za-zÀ-ÿ]{4,}", propre)
    if premier_mot_match:
        prefixe = propre[:premier_mot_match.start()]
        if len(RE_POURCENTAGE_FRAGMENT.findall(prefixe)) > 1:
            alertes.append("Plusieurs pourcentages détectés avant le premier mot métier.")
    return not alertes, alertes


def classifier_ligne(texte: str) -> str:
    bas = nettoyer_ligne(texte).lower()
    if not bas:
        return "ignoree"
    if any(mot in bas for mot in MOTS_ENTETE):
        if not RE_UNITE.search(bas) or "prix unitaire" in bas:
            return "ignoree"
    if any(mot in bas for mot in MOTS_TOTAL):
        return "total" if "total" in bas and "sous" not in bas else "sous_total"
    if RE_UNITE.search(bas):
        return "article"
    if RE_UNITE.search(bas) and len(RE_NOMBRE.findall(bas)) >= 2:
        return "article"
    if len(bas) < 4:
        return "ignoree"
    return "titre"


def _nombres_apres_unite(texte: str) -> list[tuple[Decimal, str, int]]:
    valeurs: list[tuple[Decimal, str, int]] = []
    tokens_entiers = re.findall(r"\b\d+\b", texte)
    if "," not in texte and "." not in texte and "€" not in texte and len(tokens_entiers) >= 3:
        position = 0
        for token in tokens_entiers:
            position = texte.find(token, position)
            valeur = convertir_decimal(token)
            if valeur is not None:
                valeurs.append((valeur, token, position))
            position += len(token)
        return valeurs

    for match in RE_NOMBRE.finditer(texte):
        valeur = convertir_decimal(match.group(0))
        if valeur is not None:
            valeurs.append((valeur, match.group(0), match.start()))
    return valeurs


def _choisir_triplet_prix(nombres: list[tuple[Decimal, str, int]]) -> tuple[Decimal | None, Decimal | None, Decimal | None, Decimal | None, list[str]]:
    corrections: list[str] = []
    valeurs = [n[0] for n in nombres]
    if len(valeurs) < 2:
        return None, None, None, None, corrections

    meilleur: tuple[Decimal, Decimal, Decimal, Decimal] | None = None
    meilleur_score: tuple[Decimal, int] | None = None
    for i, quantite in enumerate(valeurs):
        if quantite <= 0:
            continue
        for j in range(i + 1, len(valeurs)):
            pu = valeurs[j]
            if pu <= 0:
                continue
            for k in range(j + 1, len(valeurs)):
                montant = valeurs[k]
                if montant <= 0:
                    continue
                calcule = (quantite * pu).quantize(Decimal("0.01"))
                ecart = abs(calcule - montant.quantize(Decimal("0.01")))
                tolerance = max(Decimal("0.05"), abs(montant) * Decimal("0.02"))
                if ecart <= tolerance:
                    score = (ecart, -k)
                    if meilleur_score is None or score < meilleur_score:
                        meilleur_score = score
                        meilleur = (quantite, pu, montant, ecart)

    if meilleur:
        return *meilleur, corrections

    if len(valeurs) >= 3:
        quantite, pu, montant = valeurs[0], valeurs[-2], valeurs[-1]
    else:
        quantite, montant = Decimal("1"), valeurs[-1]
        pu = montant
        corrections.append("Quantité absente : quantité 1 proposée.")

    calcule = (quantite * pu).quantize(Decimal("0.01")) if quantite and pu else None
    ecart = abs(calcule - montant.quantize(Decimal("0.01"))) if calcule is not None else None
    if ecart and ecart > max(Decimal("0.05"), abs(montant) * Decimal("0.05")):
        if quantite and montant and not pu:
            pu = (montant / quantite).quantize(Decimal("0.0001"))
            corrections.append("Prix unitaire recalculé depuis quantité et montant.")
        else:
            corrections.append("Écart détecté entre quantité x PU et montant.")
    return quantite, pu, montant, ecart, corrections


def controler_ligne(ligne: LigneCandidate) -> LigneCandidate:
    qte = ligne.quantite
    pu = ligne.prix_unitaire_ht
    montant = ligne.montant_ht
    if qte and pu and not montant:
        montant = (qte * pu).quantize(Decimal("0.01"))
        ligne.montant_ht = montant
        ligne.corrections_proposees.append("Montant recalculé depuis quantité et prix unitaire.")
    if qte and montant and (not pu or pu <= 0):
        ligne.prix_unitaire_ht = (montant / qte).quantize(Decimal("0.0001"))
        ligne.corrections_proposees.append("Prix unitaire recalculé depuis quantité et montant.")

    if ligne.quantite and ligne.prix_unitaire_ht and ligne.montant_ht:
        ligne.montant_recalcule_ht = (ligne.quantite * ligne.prix_unitaire_ht).quantize(Decimal("0.01"))
        ligne.ecart_montant_ht = abs(ligne.montant_recalcule_ht - ligne.montant_ht.quantize(Decimal("0.01")))
        tolerance = max(Decimal("0.05"), abs(ligne.montant_ht) * Decimal("0.05"))
        if ligne.ecart_montant_ht > tolerance:
            ligne.statut_controle = "alerte"
            ligne.score_confiance = Decimal("0.55")
            if "Écart détecté entre quantité x PU et montant." not in ligne.corrections_proposees:
                ligne.corrections_proposees.append("Écart détecté entre quantité x PU et montant.")
    return ligne


def parser_ligne_prix_candidate(texte: str) -> LigneCandidate | None:
    brut = nettoyer_ligne(texte)
    if not brut:
        return None
    type_ligne = classifier_ligne(brut)
    if type_ligne != "article":
        return LigneCandidate(designation=brut, type_ligne=type_ligne, statut_controle="ignoree")

    unite_match = RE_UNITE.search(brut)
    if not unite_match:
        return None

    avant = nettoyer_ligne(brut[:unite_match.start()])
    apres = nettoyer_ligne(brut[unite_match.end():])
    unite = normaliser_unite(unite_match.group(1))
    numero = ""
    designation = avant

    match_numero = RE_NUMERO_DEBUT.match(avant)
    if match_numero:
        reste = nettoyer_ligne(match_numero.group(2))
        premier_reste = reste.split(" ", 1)[0] if reste else ""
        debut_pollue = premier_reste.startswith("€") or RE_POURCENTAGE_FRAGMENT.match(premier_reste) or (
            sum(1 for t, _d, _f in _tokens_avec_positions(reste[:detecter_debut_designation_metier(reste)]) if _est_fragment_colonne(t)) >= 2
        )
        if not debut_pollue:
            numero = match_numero.group(1).replace(".", ",")
            designation = reste

    designation_originale = designation
    designation_nettoyee, fragments_supprimes = nettoyer_designation_prix_extraite(designation)
    if not designation_nettoyee:
        return None
    designation = designation_nettoyee

    nombres = _nombres_apres_unite(apres)
    quantite, pu, montant, ecart, corrections = _choisir_triplet_prix(nombres)
    if not montant and not pu:
        return None

    designation_valide, alertes_designation = valider_designation_extraite(designation)
    if fragments_supprimes:
        corrections.append("Désignation reconstruite avec nettoyage de fragments numériques.")
    if not designation_valide:
        corrections.append("Désignation polluée par des valeurs numériques : vérifier le libellé extrait.")
        corrections.extend(alertes_designation)

    ligne = LigneCandidate(
        numero=numero,
        designation=designation,
        designation_originale=designation_originale,
        fragments_supprimes=fragments_supprimes,
        nettoyage_designation=bool(fragments_supprimes or designation != designation_originale),
        unite=unite,
        quantite=quantite,
        prix_unitaire_ht=pu,
        montant_ht=montant,
        ecart_montant_ht=ecart,
        statut_controle="alerte" if not designation_valide or fragments_supprimes else "ok",
        score_confiance=Decimal("0.60") if not designation_valide else (Decimal("0.70") if fragments_supprimes else Decimal("0.80")),
        corrections_proposees=corrections,
    )
    return controler_ligne(ligne)


def _titre_parent_depuis_ligne(ligne: str) -> tuple[str, str] | None:
    propre = nettoyer_ligne(ligne)
    if RE_UNITE.search(propre):
        return None
    match = RE_NUMERO_DEBUT.match(propre)
    if not match:
        return None
    numero = match.group(1).replace(".", ",")
    designation = nettoyer_ligne(match.group(2))
    if not re.search(r"[A-Za-zÀ-ÿ]", designation):
        return None
    if not designation or len(designation) < 5:
        return None
    return numero, designation


def _appliquer_parent(ligne: LigneCandidate, parent: tuple[str, str] | None) -> LigneCandidate:
    if not parent:
        return ligne
    numero_parent, designation_parent = parent
    if re.fullmatch(r"[a-z]", ligne.numero or "", flags=re.IGNORECASE):
        ligne.numero = f"{numero_parent}{ligne.numero.lower()}"
        ligne.designation = f"{designation_parent} - {ligne.designation.lstrip('_- ')}"
        return ligne
    if not ligne.numero and ligne.designation:
        match = RE_SOUS_ARTICLE.match(ligne.designation)
        if match:
            ligne.numero = f"{numero_parent}{match.group(2).lower()}"
            ligne.designation = f"{designation_parent} - {match.group(3).lstrip('_- ')}"
    return ligne


def reconstruire_lignes_depuis_texte(texte: str) -> tuple[list[dict], dict]:
    lignes = [nettoyer_ligne(ligne) for ligne in (texte or "").splitlines()]
    lignes = [ligne for ligne in lignes if ligne]
    resultats: list[LigneCandidate] = []
    rejetees = 0
    buffer: list[str] = []
    numero_en_attente = ""
    parent: tuple[str, str] | None = None

    def tenter_buffer() -> bool:
        nonlocal buffer, rejetees, parent
        if not buffer:
            return False
        candidat = parser_ligne_prix_candidate(" ".join(buffer))
        if candidat and candidat.type_ligne == "article" and candidat.designation:
            candidat = _appliquer_parent(candidat, parent)
            if candidat.prix_unitaire_ht and candidat.prix_unitaire_ht > 0:
                resultats.append(candidat)
                buffer = []
                return True
        return False

    for ligne in lignes:
        classe = classifier_ligne(ligne)
        if classe == "ignoree" and buffer and re.fullmatch(r"[\d\s\u00a0,.€]+", ligne):
            classe = "article"
        if classe in {"ignoree", "total", "sous_total"}:
            if buffer and not tenter_buffer():
                rejetees += 1
                buffer = []
            continue

        titre_parent = _titre_parent_depuis_ligne(ligne)
        if titre_parent and not buffer:
            parent = titre_parent
            continue

        numero_seul = RE_NUMERO_SEUL.match(ligne)
        if numero_seul and not buffer and not RE_UNITE.search(ligne):
            numero_en_attente = numero_seul.group(1).replace(".", ",")
            buffer = [numero_en_attente]
            continue

        if numero_en_attente and not buffer:
            buffer.append(numero_en_attente)
            numero_en_attente = ""
        buffer.append(ligne)
        if tenter_buffer():
            numero_en_attente = ""
            continue
        if len(buffer) > 8:
            rejetees += 1
            buffer = []
            numero_en_attente = ""

    if buffer and not tenter_buffer():
        rejetees += 1

    lignes_dict = []
    for index, ligne in enumerate(resultats, start=1):
        lignes_dict.append({
            "ordre": index,
            "numero": ligne.numero,
            "designation": ligne.designation,
            "designation_originale": ligne.designation_originale or ligne.designation,
            "fragments_supprimes": ligne.fragments_supprimes,
            "nettoyage_designation": ligne.nettoyage_designation,
            "unite": ligne.unite,
            "quantite": ligne.quantite,
            "prix_unitaire": ligne.prix_unitaire_ht,
            "montant": ligne.montant_ht,
            "montant_recalcule": ligne.montant_recalcule_ht,
            "ecart_montant": ligne.ecart_montant_ht,
            "type_ligne": ligne.type_ligne,
            "statut_controle": ligne.statut_controle,
            "score_confiance": ligne.score_confiance,
            "corrections_proposees": ligne.corrections_proposees,
        })

    diagnostic = {
        "nb_lignes_candidates": len(resultats),
        "nb_lignes_rejetees": rejetees,
        "methode": "texte_adaptatif",
        "raisons_rejets": ["ligne_incomplete_ou_total"] if rejetees else [],
    }
    return lignes_dict, diagnostic


def reconstruire_lignes_depuis_tableaux(tableaux: Iterable[Iterable[Iterable[object]]]) -> tuple[list[dict], dict]:
    texte_lignes = []
    for tableau in tableaux or []:
        for ligne in tableau or []:
            cellules = [nettoyer_ligne(str(cellule)) for cellule in ligne if cellule is not None and nettoyer_ligne(str(cellule))]
            if cellules:
                texte_lignes.append(" ".join(cellules))
    return reconstruire_lignes_depuis_texte("\n".join(texte_lignes))


def detecter_type_document(texte: str, nom_fichier: str = "") -> str:
    contenu = f"{nom_fichier}\n{texte[:4000]}".lower()
    if "dpgf" in contenu or "décomposition du prix" in contenu or "decomposition du prix" in contenu:
        return "dpgf"
    if "dqe" in contenu or "détail quantitatif" in contenu or "detail quantitatif" in contenu:
        return "dqe"
    if "bpu" in contenu or "bordereau de prix" in contenu:
        return "bpu"
    if "estimation" in contenu:
        return "estimation"
    if "bon de commande" in contenu:
        return "bon_commande"
    if "devis" in contenu:
        return "devis"
    return "autre"


def detecter_colonnes(entetes: Iterable[str]) -> dict[str, int]:
    synonymes = {
        "numero": ("n°", "no", "n de prix", "article", "poste", "code"),
        "designation": ("désignation", "designation", "postes", "description", "libellé", "libelle", "ouvrages"),
        "unite": ("u", "unité", "unite"),
        "quantite": ("qté", "quantité", "quantite", "quantité nette", "quantité brute", "total qtés"),
        "prix_unitaire": ("pu", "p.u.", "prix unitaire", "prix unit"),
        "montant": ("total", "prix total", "total ht", "somme", "montant ht"),
    }
    resultat: dict[str, int] = {}
    for index, entete in enumerate(entetes):
        normalise = nettoyer_ligne(str(entete)).lower()
        for champ, mots in synonymes.items():
            if champ not in resultat and any(mot in normalise for mot in mots):
                resultat[champ] = index
    return resultat
