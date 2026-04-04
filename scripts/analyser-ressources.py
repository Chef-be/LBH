#!/usr/bin/env python3
# ============================================================
# Analyseur de ressources documentaires
# Plateforme BEE — Script d'ingestion et d'analyse
# ============================================================
# Ce script analyse les fichiers déposés dans ressources/entree/
# Il peut aussi être utilisé pour produire un rapport synthétique
# sur les documents métier disponibles.
#
# Usage :
#   python scripts/analyser-ressources.py [--mode ingestion|analyse|resume]
#   --mode ingestion : classe et indexe les nouveaux fichiers
#   --mode analyse   : extrait le texte et crée des résumés
#   --mode resume    : affiche un résumé de toutes les ressources
# ============================================================

import os
import sys
import json
import hashlib
import shutil
import datetime
import argparse
import unicodedata
import re
import subprocess
from pathlib import Path

RACINE_PROJET = Path(__file__).parent.parent


def determiner_repertoire_sources() -> Path:
    """Détermine le répertoire source des documents métier."""
    candidats = []

    chemin_env = os.environ.get("CHEMIN_RESSOURCES_DOCUMENTAIRES")
    if chemin_env:
        candidats.append(Path(chemin_env))

    candidats.extend([
        Path("/var/www/vhosts/lbh-economiste.com/smb.lbh-economiste.com/data/samba/shares/admin/ressources"),
        Path("/var/www/vhosts/lbh-economiste.com/ressources"),
    ])

    for candidat in candidats:
        if candidat.exists():
            return candidat

    return candidats[0]


def determiner_repertoire_travail() -> Path:
    """Détermine le répertoire local de travail pour l'indexation."""
    chemin_env = os.environ.get("CHEMIN_RESSOURCES_TRAVAIL")
    if chemin_env:
        return Path(chemin_env)
    return Path("/var/www/vhosts/lbh-economiste.com/ressources")


SOURCES_RESSOURCES = determiner_repertoire_sources()
RACINE_RESSOURCES = determiner_repertoire_travail()
ENTREE = RACINE_RESSOURCES / "entree"
DOCUMENTS = RACINE_RESSOURCES / "documents"
INDEXATION = RACINE_RESSOURCES / "indexation"
TRAITEMENT = RACINE_RESSOURCES / "traitement"
ARCHIVES = RACINE_RESSOURCES / "archives" / "imports"
CATALOGUE = INDEXATION / "catalogue.csv"
CORRESPONDANCES = INDEXATION / "correspondances.json"

# Familles métier et mots-clés associés pour la classification automatique
FAMILLES_METIER = {
    "voirie": ["voirie", "chaussée", "chaussee", "vrd", "bitume", "revêtement", "revetement",
               "terrassement", "drainage", "assainissement", "trafic", "essieu", "portance",
               "cbr", "ev2", "grave", "enrobé", "enrobe", "dimensionnement"],
    "batiment": ["bâtiment", "batiment", "maçonnerie", "maconnerie", "fondation", "dallage",
                 "structure", "béton", "beton", "acier", "charpente", "toiture", "plancher",
                 "soubassement", "mur", "paroi"],
    "economie": ["économie", "economie", "chiffrage", "estimation", "bordereau", "prix",
                 "marché", "marche", "appel offres", "mémoire", "memoire", "dpgf", "bpu", "dqe",
                 "déboursé", "debourse", "marge", "coût", "cout"],
    "reglementaire": ["dtü", "dtu", "norme", "nf", "en", "ccag", "ccap", "cctp", "fascicule",
                      "réglementation", "reglementation", "loi", "décret", "decret", "arrêté",
                      "arrete", "instruction"],
    "securite": ["sécurité", "securite", "sps", "ppsps", "risque", "prevention", "signalisation",
                 "balisage", "hygiène", "hygiene"],
}

TYPES_DOCUMENT = {
    "guide_technique": ["guide", "manuel", "méthode", "methode", "catalogue", "référentiel", "referentiel"],
    "norme": ["norme", "dtu", "nf ", "en ", "iso"],
    "etude": ["étude", "etude", "rapport", "note"],
    "plan": ["plan", "dessin", "coupe", "élévation", "elevation"],
    "tableur": ["bordereau", "quantitatif", "devis", "dpgf", "bpu", "dqe"],
    "procedure": ["procédure", "procedure", "mode opératoire", "mode operatoire"],
}


def extraire_titre_pdf(chemin: Path) -> str:
    """Tente d'extraire le titre PDF via les métadonnées système."""
    try:
        resultat = subprocess.run(
            ["pdfinfo", str(chemin)],
            capture_output=True,
            text=True,
            check=False,
        )
        for ligne in resultat.stdout.splitlines():
            if ligne.startswith("Title:"):
                titre = ligne.split(":", 1)[1].strip()
                if titre and titre.lower() not in {"", "untitled"}:
                    return titre
    except Exception:
        pass
    return ""


def initialiser_arborescence():
    """Prépare l'arborescence minimale et les fichiers d'indexation."""
    for dossier in (
        RACINE_RESSOURCES,
        ENTREE,
        DOCUMENTS,
        INDEXATION,
        TRAITEMENT,
        ARCHIVES,
    ):
        dossier.mkdir(parents=True, exist_ok=True)

    if not CORRESPONDANCES.exists():
        with open(CORRESPONDANCES, "w", encoding="utf-8") as f:
            json.dump({"documents": []}, f, ensure_ascii=False, indent=2)


def normaliser_nom(nom: str) -> str:
    """Convertit un nom de fichier en nom normalisé stable."""
    # Supprimer l'extension
    extension = Path(nom).suffix.lower()
    base = Path(nom).stem
    # Normaliser les caractères
    base = unicodedata.normalize("NFKD", base).encode("ascii", "ignore").decode("ascii")
    # Minuscules, tirets
    base = base.lower()
    base = re.sub(r"[^a-z0-9]+", "-", base)
    base = re.sub(r"-+", "-", base).strip("-")
    return f"{base}{extension}"


def detecter_famille(nom: str, contenu: str = "") -> tuple[str, float]:
    """Détecte la famille métier d'un document par analyse du nom et du contenu."""
    texte = (nom + " " + contenu).lower()
    scores = {}
    for famille, mots_cles in FAMILLES_METIER.items():
        score = sum(1 for mc in mots_cles if mc in texte)
        if score > 0:
            scores[famille] = score

    if not scores:
        return "general", 0.3

    meilleure = max(scores, key=scores.get)
    confiance = min(0.95, 0.5 + scores[meilleure] * 0.1)
    return meilleure, confiance


def detecter_type_document(nom: str, contenu: str = "") -> str:
    """Détecte le type de document."""
    texte = (nom + " " + contenu).lower()
    for type_doc, mots in TYPES_DOCUMENT.items():
        if any(m in texte for m in mots):
            return type_doc
    return "document_divers"


def extraire_texte_pdf(chemin: Path) -> str:
    """Extrait le texte d'un fichier PDF (si PyMuPDF disponible)."""
    try:
        import fitz  # PyMuPDF
        doc = fitz.open(str(chemin))
        texte = ""
        for page in doc[:5]:  # Limiter aux 5 premières pages pour l'analyse
            texte += page.get_text()
        doc.close()
        return texte[:5000]  # Limiter à 5000 caractères
    except ImportError:
        pass
    except Exception as e:
        return f"[Erreur extraction : {e}]"

    try:
        resultat = subprocess.run(
            ["pdftotext", "-f", "1", "-l", "8", str(chemin), "-"],
            capture_output=True,
            text=True,
            check=False,
        )
        if resultat.stdout:
            return resultat.stdout[:5000]
    except Exception as e:
        return f"[Erreur extraction : {e}]"

    return ""


def extraire_annee_depuis_texte(*valeurs: str) -> str:
    """Extrait une année pertinente depuis des métadonnées ou du texte."""
    corpus = " ".join(valeurs)
    annees = re.findall(r"\b(19\d{2}|20\d{2})\b", corpus)
    return annees[-1] if annees else ""


def proposer_nom_metier(chemin: Path, titre: str, texte: str) -> str:
    """Construit un nom métier lisible et stable pour un document PDF."""
    base = titre or chemin.stem
    base = re.sub(r"\b(?:edition|édition)\b", "ed", base, flags=re.IGNORECASE)
    base = re.sub(r"\bconverti\b", "", base, flags=re.IGNORECASE)
    base = re.sub(r"\s+", " ", base).strip(" -_")
    annee = extraire_annee_depuis_texte(titre, texte, chemin.stem)
    nom = normaliser_nom(base)
    if annee and annee not in nom:
        nom = f"{Path(nom).stem}-{annee}{chemin.suffix.lower()}"
    return nom


def lister_pdfs_sources() -> list[Path]:
    """Retourne les PDF disponibles dans le répertoire source métier."""
    if not SOURCES_RESSOURCES.exists():
        return []
    return sorted(
        chemin for chemin in SOURCES_RESSOURCES.rglob("*.pdf")
        if chemin.is_file() and not chemin.name.startswith(".")
    )


def calculer_empreinte(chemin: Path) -> str:
    """Calcule le hash MD5 d'un fichier pour détecter les doublons."""
    h = hashlib.md5()
    with open(chemin, "rb") as f:
        for bloc in iter(lambda: f.read(65536), b""):
            h.update(bloc)
    return h.hexdigest()


def charger_catalogue() -> list:
    """Charge le catalogue CSV des ressources."""
    if not CATALOGUE.exists():
        return []
    import csv
    with open(CATALOGUE, "r", encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def sauvegarder_catalogue(entrees: list):
    """Sauvegarde le catalogue CSV."""
    import csv
    champs = ["nom_origine", "nom_normalise", "chemin_normalise", "date_import",
              "type_document", "famille_metier", "mots_cles", "niveau_confiance",
              "statut", "observations"]
    with open(CATALOGUE, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=champs)
        w.writeheader()
        w.writerows(entrees)


def charger_correspondances() -> dict:
    initialiser_arborescence()
    with open(CORRESPONDANCES, "r", encoding="utf-8") as f:
        return json.load(f)


def sauvegarder_correspondances(data: dict):
    initialiser_arborescence()
    with open(CORRESPONDANCES, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def ingerer_fichiers():
    """Mode ingestion : traite les fichiers dans entree/ et les classe."""
    initialiser_arborescence()
    fichiers = [f for f in ENTREE.iterdir() if f.is_file() and not f.name.startswith(".")]

    if not fichiers:
        print("✅ Aucun nouveau fichier à ingérer dans entree/")
        return

    print(f"📂 {len(fichiers)} fichier(s) trouvé(s) dans entree/\n")
    catalogue = charger_catalogue()
    correspondances = charger_correspondances()
    noms_existants = {e["nom_origine"] for e in catalogue}

    traites = 0
    erreurs = 0

    for fichier in fichiers:
        print(f"  → Traitement : {fichier.name}")
        if fichier.name in noms_existants:
            print(f"    ⚠️  Déjà indexé — ignoré.")
            continue

        try:
            # Extraire le texte si PDF
            contenu = ""
            if fichier.suffix.lower() == ".pdf":
                contenu = extraire_texte_pdf(fichier)

            # Classifier
            famille, confiance = detecter_famille(fichier.name, contenu)
            type_doc = detecter_type_document(fichier.name, contenu)
            nom_normalise = normaliser_nom(fichier.name)

            # Destination
            dest_dossier = DOCUMENTS / famille
            dest_dossier.mkdir(parents=True, exist_ok=True)
            dest_chemin = dest_dossier / nom_normalise

            # Gérer les conflits de noms
            compteur = 1
            while dest_chemin.exists():
                base = dest_dossier / f"{Path(nom_normalise).stem}-{compteur}{Path(nom_normalise).suffix}"
                dest_chemin = base
                compteur += 1

            # Copier vers archive
            ARCHIVES.mkdir(parents=True, exist_ok=True)
            shutil.copy2(fichier, ARCHIVES / fichier.name)

            # Déplacer vers destination classifiée
            shutil.move(str(fichier), str(dest_chemin))

            # Enregistrer dans le catalogue
            entree = {
                "nom_origine": fichier.name,
                "nom_normalise": dest_chemin.name,
                "chemin_normalise": str(dest_chemin.relative_to(RACINE_RESSOURCES)),
                "date_import": datetime.datetime.now().strftime("%Y-%m-%d %H:%M"),
                "type_document": type_doc,
                "famille_metier": famille,
                "mots_cles": "",
                "niveau_confiance": f"{confiance:.2f}",
                "statut": "indexe",
                "observations": f"Classé automatiquement — confiance {confiance:.0%}",
            }
            catalogue.append(entree)

            # Enregistrer dans correspondances.json
            correspondances["documents"].append({
                "nom_origine": fichier.name,
                "nom_normalise": dest_chemin.name,
                "chemin_normalise": str(dest_chemin.relative_to(RACINE_RESSOURCES)),
                "date_import": datetime.datetime.now().isoformat(),
                "type_document": type_doc,
                "famille_metier": famille,
                "niveau_confiance": confiance,
                "extrait_texte": contenu[:500] if contenu else "",
            })

            print(f"    ✅ Classé → documents/{famille}/{dest_chemin.name} (confiance : {confiance:.0%})")
            traites += 1

        except Exception as e:
            print(f"    ❌ Erreur : {e}")
            erreurs += 1

    sauvegarder_catalogue(catalogue)
    sauvegarder_correspondances(correspondances)

    print(f"\n{'='*50}")
    print(f"✅ Ingestion terminée : {traites} traités, {erreurs} erreurs")
    print(f"📋 Catalogue mis à jour : {CATALOGUE}")


def afficher_resume():
    """Mode résumé : affiche l'état de toutes les ressources documentaires."""
    initialiser_arborescence()
    catalogue = charger_catalogue()
    pdfs_sources = lister_pdfs_sources()

    print("=" * 60)
    print("RÉSUMÉ DES RESSOURCES DOCUMENTAIRES — Plateforme BEE")
    print("=" * 60)
    print(f"Répertoire source métier : {SOURCES_RESSOURCES}")
    print(f"Répertoire de travail BEE : {RACINE_RESSOURCES}")
    print(f"Total documents indexés : {len(catalogue)}")
    print(f"PDF détectés dans la source documentaire : {len(pdfs_sources)}")
    print()

    # Grouper par famille
    familles = {}
    for entree in catalogue:
        f = entree.get("famille_metier", "autre")
        familles.setdefault(f, []).append(entree)

    for famille, docs in sorted(familles.items()):
        print(f"\n📁 {famille.upper()} ({len(docs)} documents)")
        for doc in docs:
            print(f"   • {doc['nom_normalise']}")
            if doc.get("observations"):
                print(f"     → {doc['observations']}")

    if not catalogue and pdfs_sources:
        print("\n📚 DOCUMENTS DIRECTEMENT DISPONIBLES SUR LE PARTAGE SAMBA")
        for pdf in pdfs_sources:
            print(f"   • {pdf.name}")

    # Fichiers en attente
    en_attente = [f for f in ENTREE.iterdir() if f.is_file() and not f.name.startswith(".")]
    if en_attente:
        print(f"\n⏳ FICHIERS EN ATTENTE D'INGESTION ({len(en_attente)})")
        for f in en_attente:
            print(f"   • {f.name}")
        print("\n  Lancer : python scripts/analyser-ressources.py --mode ingestion")

    print("\n" + "=" * 60)


def renommer_sources():
    """Propose et applique un renommage stable sur les PDF métier du partage Samba."""
    pdfs_sources = lister_pdfs_sources()
    if not pdfs_sources:
        print("Aucun PDF détecté dans la source documentaire.")
        return

    propositions = []
    for pdf in pdfs_sources:
        titre = extraire_titre_pdf(pdf)
        texte = extraire_texte_pdf(pdf)
        nom_propose = proposer_nom_metier(pdf, titre, texte)
        if nom_propose == pdf.name:
            continue
        propositions.append((pdf, pdf.with_name(nom_propose), titre))

    if not propositions:
        print("Aucun renommage nécessaire.")
        return

    print(f"{len(propositions)} renommage(s) proposé(s) :")
    for source, destination, titre in propositions:
        print(f"  • {source.name} -> {destination.name}")
        if titre:
            print(f"    titre : {titre}")

    for source, destination, _ in propositions:
        cible = destination
        compteur = 1
        while cible.exists():
            cible = destination.with_name(f"{destination.stem}-{compteur}{destination.suffix}")
            compteur += 1
        source.rename(cible)

    print("\nRenommage terminé.")


def analyser_ressources_detaillees():
    """
    Mode analyse : extrait le texte des PDF et produit
    un rapport structuré sur les ressources documentaires.
    """
    initialiser_arborescence()
    correspondances = charger_correspondances()
    docs = correspondances.get("documents", [])
    pdfs_sources = lister_pdfs_sources()

    total_documents = len(docs) if docs else len(pdfs_sources)
    print(f"Analyse de {total_documents} documents pour compréhension du domaine...\n")

    rapport = {
        "date_analyse": datetime.datetime.now().isoformat(),
        "repertoire_source": str(SOURCES_RESSOURCES),
        "repertoire_travail": str(RACINE_RESSOURCES),
        "total_documents": total_documents,
        "documents_analyses": [],
    }

    documents_a_analyser = []
    if docs:
        for doc in docs:
            documents_a_analyser.append({
                "nom": doc["nom_normalise"],
                "famille": doc["famille_metier"],
                "type": doc["type_document"],
                "chemin": RACINE_RESSOURCES / doc["chemin_normalise"],
            })
    else:
        for pdf in pdfs_sources:
            famille, confiance = detecter_famille(pdf.name)
            documents_a_analyser.append({
                "nom": pdf.name,
                "famille": famille,
                "type": detecter_type_document(pdf.name),
                "chemin": pdf,
                "niveau_confiance": confiance,
            })

    for doc in documents_a_analyser:
        chemin = Path(doc["chemin"])
        if not Path(chemin).exists():
            continue

        if chemin.suffix.lower() == ".pdf":
            texte = extraire_texte_pdf(Path(chemin))
            rapport["documents_analyses"].append({
                "nom": doc["nom"],
                "famille": doc["famille"],
                "type": doc["type"],
                "extrait": texte[:2000],
            })
            print(f"  ✅ {doc['nom']} ({doc['famille']})")
        else:
            print(f"  ⏭️  {doc['nom']} (format non-PDF ignoré)")

    # Sauvegarder le rapport
    rapport_chemin = RACINE_RESSOURCES / "indexation" / "rapport-analyse.json"
    with open(rapport_chemin, "w", encoding="utf-8") as f:
        json.dump(rapport, f, ensure_ascii=False, indent=2)

    print(f"\n✅ Rapport sauvegardé : {rapport_chemin}")
    print("   Le rapport peut être exploité pour l'analyse documentaire interne.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Analyseur de ressources documentaires")
    parser.add_argument("--mode", choices=["ingestion", "analyse", "resume", "renommer-sources"],
                        default="resume", help="Mode d'opération")
    args = parser.parse_args()

    if args.mode == "ingestion":
        ingerer_fichiers()
    elif args.mode == "analyse":
        analyser_ressources_detaillees()
    elif args.mode == "resume":
        afficher_resume()
    elif args.mode == "renommer-sources":
        renommer_sources()
