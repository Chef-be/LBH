#!/usr/bin/env python3
# ============================================================
# INSTALLATEUR PAR NAVIGATEUR — Plateforme
# ============================================================
# Cet installateur est un service autonome Flask.
# Il tourne AVANT le démarrage de la plateforme principale.
# Il génère le fichier .env et le compose.yaml depuis des gabarits.
# Il se verrouille automatiquement après une installation réussie.
#
# Démarrage : python app.py
# Ou via : docker compose -f compose.installateur.yaml up
# ============================================================

import os
import re
import sys
import json
import time
import socket
import subprocess
import secrets
import datetime
from pathlib import Path
from flask import Flask, render_template, request, jsonify, redirect, url_for, session

# Détection du répertoire racine du projet
RACINE_PROJET = Path(__file__).parent.parent
# Chemin hôte réel (distinct du chemin conteneur /projet) — pour les device: des volumes Docker
RACINE_PROJET_HOTE = os.environ.get("RACINE_PROJET_HOTE", str(RACINE_PROJET))
FICHIER_VERROU = RACINE_PROJET / "installateur" / ".installation-terminee"
FICHIER_ENV = RACINE_PROJET / ".env"
FICHIER_COMPOSE = RACINE_PROJET / "compose.yaml"

app = Flask(__name__, template_folder="gabarits/interface")
app.secret_key = secrets.token_hex(32)


# ------------------------------------------------------------
# Vérification du verrou d'installation
# ------------------------------------------------------------
def installation_terminee() -> bool:
    return FICHIER_VERROU.exists()


def verifier_verrou(f):
    """Décorateur : redirige vers la page terminée si installation déjà faite."""
    from functools import wraps
    @wraps(f)
    def enveloppe(*args, **kwargs):
        if installation_terminee() and request.endpoint != "terminee":
            return redirect(url_for("terminee"))
        return f(*args, **kwargs)
    return enveloppe


# ------------------------------------------------------------
# Utilitaires
# ------------------------------------------------------------
def generer_secret(longueur: int = 64) -> str:
    return secrets.token_hex(longueur)


def port_libre(port: int) -> bool:
    """
    Vérifie qu'un port est réellement disponible sur toutes les interfaces.
    Teste 127.0.0.1, 0.0.0.0 et ::1 (IPv6) pour ne manquer aucun service actif.
    """
    for hote in ("127.0.0.1", "0.0.0.0"):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(0.5)
            if s.connect_ex((hote, port)) == 0:
                return False
    # Test IPv6
    try:
        with socket.socket(socket.AF_INET6, socket.SOCK_STREAM) as s:
            s.settimeout(0.5)
            if s.connect_ex(("::1", port)) == 0:
                return False
    except OSError:
        pass
    return True


def avertissement_port(port: int) -> str | None:
    """
    Retourne un message d'avertissement si le port est connu comme réservé
    par Plesk ou un service système, même s'il est temporairement libre.
    """
    PORTS_RESERVES = {
        # Plesk core
        8443: "Port HTTPS de l'interface Plesk",
        8880: "Port HTTP de l'interface Plesk",
        # HTTP/HTTPS standard
        80: "Port HTTP standard (nginx/Apache Plesk)",
        443: "Port HTTPS standard (nginx/Apache Plesk)",
        # SSH/FTP
        22: "Port SSH",
        21: "Port FTP",
        # Base de données
        5432: "Port PostgreSQL système (partagé Plesk)",
        3306: "Port MySQL/MariaDB Plesk",
        # Services Plesk courants
        7080: "Port Plesk Proxy",
        7443: "Port Plesk Proxy HTTPS",
        9000: "Port Plesk Roundcube/RoundCube ou PHP-FPM",
        # Conteneurs existants sur ce serveur
        3080: "Port utilisé par le projet CSA (conteneur existant)",
        3081: "Port utilisé par le projet CSA (conteneur existant)",
        8080: "Port utilisé par Keycloak (conteneur existant)",
        8081: "Port Keycloak administration",
        8082: "Port utilisé par un conteneur existant",
        8083: "Port utilisé par un conteneur existant",
        8084: "Port Collabora Online (conteneur existant)",
        # Messagerie
        25: "Port SMTP",
        465: "Port SMTP SSL",
        587: "Port SMTP soumission",
        110: "Port POP3",
        995: "Port POP3S",
        143: "Port IMAP",
        993: "Port IMAPS",
    }
    return PORTS_RESERVES.get(port)


def trouver_port_libre(debut: int, fin: int = 65535) -> int:
    """Trouve le premier port libre en évitant les ports réservés Plesk/système."""
    for port in range(debut, fin):
        if port_libre(port) and avertissement_port(port) is None:
            return port
    raise RuntimeError(f"Aucun port libre trouvé entre {debut} et {fin}")


def detecter_docker() -> dict:
    """Vérifie la disponibilité de Docker et Docker Compose."""
    resultat = {"docker": False, "compose": False, "version_docker": "", "version_compose": ""}
    try:
        r = subprocess.run(["docker", "--version"], capture_output=True, text=True, timeout=5)
        if r.returncode == 0:
            resultat["docker"] = True
            resultat["version_docker"] = r.stdout.strip()
    except Exception:
        pass
    try:
        r = subprocess.run(["docker", "compose", "version"], capture_output=True, text=True, timeout=5)
        if r.returncode == 0:
            resultat["compose"] = True
            resultat["version_compose"] = r.stdout.strip()
    except Exception:
        pass
    return resultat


def verifier_espace_disque(chemin: str = "/") -> dict:
    import shutil
    total, utilise, libre = shutil.disk_usage(chemin)
    return {
        "total_go": round(total / 1e9, 1),
        "utilise_go": round(utilise / 1e9, 1),
        "libre_go": round(libre / 1e9, 1),
        "pourcentage": round(utilise / total * 100, 1),
        "suffisant": libre / 1e9 >= 20,
    }


def verifier_memoire() -> dict:
    try:
        import psutil
        mem = psutil.virtual_memory()
        return {
            "total_go": round(mem.total / 1e9, 1),
            "disponible_go": round(mem.available / 1e9, 1),
            "pourcentage": mem.percent,
            "suffisant": mem.available / 1e9 >= 4,
        }
    except ImportError:
        # Fallback sans psutil
        with open("/proc/meminfo") as f:
            lignes = {l.split(":")[0]: int(l.split(":")[1].strip().split()[0]) for l in f if ":" in l}
        total = lignes.get("MemTotal", 0) * 1024
        disponible = lignes.get("MemAvailable", 0) * 1024
        return {
            "total_go": round(total / 1e9, 1),
            "disponible_go": round(disponible / 1e9, 1),
            "pourcentage": round((total - disponible) / total * 100, 1) if total else 0,
            "suffisant": disponible / 1e9 >= 4,
        }


def ports_suggeres(prefixe: str) -> dict:
    """Propose des ports libres pour les services."""
    return {
        "entree_plesk": trouver_port_libre(3082),
        "minio_api": trouver_port_libre(9100),
        "minio_console": trouver_port_libre(9101),
        "postgresql_local": trouver_port_libre(5434),
    }


def normaliser_prefixe(prefixe: str) -> str:
    """Normalise le préfixe : minuscules, tirets, sans caractères spéciaux."""
    prefixe = prefixe.lower().strip()
    prefixe = re.sub(r"[^a-z0-9-]", "-", prefixe)
    prefixe = re.sub(r"-+", "-", prefixe).strip("-")
    return prefixe or "plateforme"


PREFIXE_PAR_DEFAUT = normaliser_prefixe(os.environ.get("INSTALLATEUR_PREFIXE_PAR_DEFAUT", "lbh"))
NOM_PLATEFORME_PAR_DEFAUT = os.environ.get("INSTALLATEUR_NOM_PLATEFORME_PAR_DEFAUT", "LBH Economiste")
SLOGAN_PAR_DEFAUT = os.environ.get(
    "INSTALLATEUR_SLOGAN_PAR_DEFAUT",
    "Bureau d'etudes economiste",
)
URL_BASE_PAR_DEFAUT = os.environ.get("INSTALLATEUR_URL_BASE_PAR_DEFAUT", "https://lbh-economiste.com")
ADMIN_URL_PAR_DEFAUT = os.environ.get(
    "INSTALLATEUR_ADMIN_URL_PAR_DEFAUT",
    "administration-technique/",
)
VERSION_INSTALLATEUR = "1.2.0"


def identifiant_sql_depuis_prefixe(prefixe: str) -> str:
    """Construit un identifiant SQL stable a partir du prefixe Docker."""
    return re.sub(r"[^a-z0-9_]", "_", (prefixe or PREFIXE_PAR_DEFAUT).replace("-", "_").lower()).strip("_") or "plateforme"


def bdd_nom_defaut(prefixe: str) -> str:
    return f"plateforme_{identifiant_sql_depuis_prefixe(prefixe)}"


def bdd_utilisateur_defaut(prefixe: str) -> str:
    return f"{identifiant_sql_depuis_prefixe(prefixe)}_appli"[:63]


def chemins_ressources_defaut(racine_hote: str) -> dict[str, str]:
    """
    Déduit des chemins de ressources modifiables via l'environnement.
    On privilégie des chemins cohérents avec le vhost courant, sans les figer en dur.
    """
    racine_vhost = Path(racine_hote).resolve().parent
    partage_admin = racine_vhost / f"smb.{racine_vhost.name}" / "data" / "samba" / "shares" / "admin" / "ressources"
    return {
        "chemin_ressources_documentaires": os.environ.get(
            "CHEMIN_RESSOURCES_DOCUMENTAIRES",
            str(partage_admin),
        ),
        "chemin_ressources_travail": os.environ.get(
            "CHEMIN_RESSOURCES_TRAVAIL",
            str(racine_vhost / "ressources"),
        ),
    }


# ------------------------------------------------------------
# Détection d'une installation existante
# ------------------------------------------------------------
def detecter_plateforme_existante() -> dict:
    """
    Détecte si une installation de la plateforme est déjà déployée sur ce serveur.
    Lit le compose.yaml existant pour extraire le préfixe,
    interroge Docker pour l'état des conteneurs,
    et vérifie si un super-administrateur existe.

    Retourne un dict avec :
    - compose_existe (bool)
    - prefixe (str|None)
    - conteneurs (list) — liste des dicts par service
    - tous_sains (bool)
    - certains_actifs (bool)
    - nb_sains / nb_total (int)
    - admin_existe (bool)
    """
    resultat = {
        "compose_existe": FICHIER_COMPOSE.exists(),
        "prefixe": None,
        "conteneurs": [],
        "tous_sains": False,
        "certains_actifs": False,
        "nb_sains": 0,
        "nb_total": 0,
        "admin_existe": False,
    }

    if not FICHIER_COMPOSE.exists():
        return resultat

    # Extraire le préfixe depuis le champ "name:" du compose.yaml
    try:
        with open(FICHIER_COMPOSE) as f:
            contenu = f.read()
        m = re.search(r"^name:\s*(\S+)", contenu, re.MULTILINE)
        if m:
            resultat["prefixe"] = m.group(1)
    except Exception:
        pass

    # Interroger Docker Compose sur l'état des conteneurs
    try:
        r = subprocess.run(
            ["docker", "compose", "-f", str(FICHIER_COMPOSE), "ps", "--format", "json"],
            capture_output=True, text=True, timeout=15, cwd=str(RACINE_PROJET)
        )
        if r.returncode == 0 and r.stdout.strip():
            conteneurs = []
            for ligne in r.stdout.strip().split("\n"):
                if ligne.strip():
                    try:
                        conteneurs.append(json.loads(ligne))
                    except json.JSONDecodeError:
                        pass
            resultat["conteneurs"] = conteneurs
            resultat["nb_total"] = len(conteneurs)
            resultat["nb_sains"] = sum(
                1 for c in conteneurs if "healthy" in c.get("Status", "").lower()
            )
            resultat["certains_actifs"] = resultat["nb_total"] > 0
            resultat["tous_sains"] = (
                resultat["nb_total"] > 0 and
                resultat["nb_sains"] == resultat["nb_total"]
            )
    except Exception:
        pass

    # Vérifier l'existence d'un super-administrateur si le backend est actif
    if resultat["prefixe"] and resultat["certains_actifs"]:
        nom_backend = f"{resultat['prefixe']}-backend"
        backend_sain = any(
            c.get("Name") == nom_backend and "healthy" in c.get("Status", "").lower()
            for c in resultat["conteneurs"]
        )
        if backend_sain:
            try:
                script = (
                    "from applications.comptes.models import Utilisateur; "
                    "print(Utilisateur.objects.filter(is_superuser=True).count())"
                )
                r = subprocess.run(
                    ["docker", "compose", "-f", str(FICHIER_COMPOSE), "exec", "-T",
                     nom_backend, "python", "manage.py", "shell", "-c", script],
                    capture_output=True, text=True, timeout=15, cwd=str(RACINE_PROJET)
                )
                if r.returncode == 0:
                    # La dernière ligne est le résultat (les autres peuvent être des imports auto)
                    derniere_ligne = r.stdout.strip().split("\n")[-1]
                    try:
                        resultat["admin_existe"] = int(derniere_ligne) > 0
                    except ValueError:
                        pass
            except Exception:
                pass

    return resultat


# ------------------------------------------------------------
# Génération des fichiers
# ------------------------------------------------------------
def generer_env(config: dict) -> str:
    """Génère le contenu du fichier .env depuis la configuration."""
    from jinja2 import Environment, FileSystemLoader
    env = Environment(loader=FileSystemLoader(str(RACINE_PROJET / "installateur" / "gabarits" / "compose")))
    gabarit = env.get_template("env.j2")
    return gabarit.render(**config)


def generer_compose(config: dict) -> str:
    """Génère le contenu du compose.yaml depuis le gabarit Jinja2."""
    from jinja2 import Environment, FileSystemLoader
    env = Environment(loader=FileSystemLoader(str(RACINE_PROJET / "installateur" / "gabarits" / "compose")))
    gabarit = env.get_template("compose.yaml.j2")
    return gabarit.render(**config)


def sauvegarder_configuration(config: dict):
    """Sauvegarde la configuration dans un fichier JSON (pour reprise)."""
    chemin = RACINE_PROJET / "installateur" / ".configuration-en-cours.json"
    with open(chemin, "w", encoding="utf-8") as f:
        # Ne pas sauvegarder les mots de passe en clair
        config_filtree = {
            k: v for k, v in config.items()
            if "mot_de_passe" not in k.lower() and "secret" not in k.lower()
        }
        json.dump(config_filtree, f, ensure_ascii=False, indent=2)


def charger_configuration() -> dict:
    """Charge la configuration depuis le fichier de reprise."""
    chemin = RACINE_PROJET / "installateur" / ".configuration-en-cours.json"
    if chemin.exists():
        with open(chemin, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def ecrire_fichiers(config: dict) -> dict:
    """Écrit le .env et le compose.yaml sur le disque."""
    resultats = {"env": False, "compose": False, "erreurs": []}
    try:
        contenu_env = generer_env(config)
        with open(FICHIER_ENV, "w", encoding="utf-8") as f:
            f.write(contenu_env)
        resultats["env"] = True
    except Exception as e:
        resultats["erreurs"].append(f"Erreur génération .env : {e}")
    try:
        contenu_compose = generer_compose(config)
        with open(FICHIER_COMPOSE, "w", encoding="utf-8") as f:
            f.write(contenu_compose)
        resultats["compose"] = True
    except Exception as e:
        resultats["erreurs"].append(f"Erreur génération compose.yaml : {e}")
    return resultats


def creer_volumes(prefixe: str, racine: str):
    """Crée les répertoires de volumes Docker."""
    dossiers = [
        f"volumes/{prefixe}/postgresql",
        f"volumes/{prefixe}/redis",
        f"volumes/{prefixe}/minio",
        f"volumes/{prefixe}/medias",
        f"volumes/{prefixe}/statiques",
        f"volumes/{prefixe}/journaux/nginx",
        f"volumes/{prefixe}/journaux/backend",
        f"volumes/{prefixe}/journaux/celery",
        f"volumes/{prefixe}/journaux/celery-beat",
        f"volumes/{prefixe}/journaux/services",
    ]
    for d in dossiers:
        Path(racine, d).mkdir(parents=True, exist_ok=True)


def executer_creation_admin(prefixe: str, courriel: str, mot_de_passe: str, prenom: str, nom: str) -> dict:
    """
    Crée le super-administrateur via docker compose exec.
    Les données sont passées par variable d'environnement (pas d'interpolation dans le script)
    pour éviter tout risque d'injection.
    """
    # Script Python qui lit les données depuis une variable d'environnement JSON
    script = (
        "import json, os; "
        "from applications.comptes.models import Utilisateur; "
        "d = json.loads(os.environ['_ADMIN_DATA']); "
        "Utilisateur.objects.create_superuser("
        "courriel=d['courriel'], password=d['password'], "
        "prenom=d['prenom'], nom=d['nom']"
        ") if not Utilisateur.objects.filter(courriel=d['courriel']).exists() "
        "else print('Administrateur déjà existant')"
    )
    donnees_json = json.dumps({
        "courriel": courriel,
        "password": mot_de_passe,
        "prenom": prenom,
        "nom": nom,
    })
    try:
        r = subprocess.run(
            ["docker", "compose", "-f", str(FICHIER_COMPOSE), "exec", "-T",
             "-e", f"_ADMIN_DATA={donnees_json}",
             f"{prefixe}-backend",
             "python", "manage.py", "shell", "-c", script],
            capture_output=True, text=True, timeout=60, cwd=str(RACINE_PROJET)
        )
        if r.returncode != 0:
            return {"succes": False, "erreur": r.stderr[-1000:] or r.stdout[-500:]}
        return {"succes": True, "message": "Compte super-administrateur créé avec succès."}
    except subprocess.TimeoutExpired:
        return {"succes": False, "erreur": "Délai dépassé lors de la création du compte."}
    except Exception as e:
        return {"succes": False, "erreur": str(e)}


# ------------------------------------------------------------
# ROUTES DE L'INSTALLATEUR
# ------------------------------------------------------------

@app.route("/")
@verifier_verrou
def accueil():
    """Page d'accueil de l'installateur — vérification des prérequis et détection d'existant."""
    docker_info = detecter_docker()
    disque_info = verifier_espace_disque(str(RACINE_PROJET))
    memoire_info = verifier_memoire()
    config_existante = charger_configuration()
    plateforme_existante = detecter_plateforme_existante()

    prets = (
        docker_info["docker"] and
        docker_info["compose"] and
        disque_info["suffisant"] and
        memoire_info["suffisant"]
    )

    return render_template("etape0-bienvenue.html",
        docker=docker_info,
        disque=disque_info,
        memoire=memoire_info,
        prets=prets,
        config_existante=config_existante,
        plateforme_existante=plateforme_existante,
        version_installateur=VERSION_INSTALLATEUR,
    )


@app.route("/etape/1", methods=["GET", "POST"])
@verifier_verrou
def etape1_identite():
    """Étape 1 : Identité et nommage de la plateforme."""
    if request.method == "POST":
        donnees = request.form.to_dict()
        prefixe = normaliser_prefixe(donnees.get("prefixe_conteneurs", PREFIXE_PAR_DEFAUT))
        session["etape1"] = {
            "nom_plateforme": donnees.get("nom_plateforme", NOM_PLATEFORME_PAR_DEFAUT),
            "prefixe_conteneurs": prefixe,
            "slogan": donnees.get("slogan", SLOGAN_PAR_DEFAUT),
            "url_base": donnees.get("url_base", URL_BASE_PAR_DEFAUT),
            "fuseau_horaire": donnees.get("fuseau_horaire", "Europe/Paris"),
            "environnement": donnees.get("environnement", "production"),
        }
        return redirect(url_for("etape2_ports"))

    config = charger_configuration()
    config.setdefault("nom_plateforme", NOM_PLATEFORME_PAR_DEFAUT)
    config.setdefault("prefixe_conteneurs", PREFIXE_PAR_DEFAUT)
    config.setdefault("slogan", SLOGAN_PAR_DEFAUT)
    config.setdefault("url_base", URL_BASE_PAR_DEFAUT)
    config.setdefault("fuseau_horaire", "Europe/Paris")
    config.setdefault("environnement", "production")
    return render_template("etape1-identite.html",
        config=config,
        fuseaux=[
            "Europe/Paris", "Europe/Brussels", "Europe/Luxembourg",
            "Europe/Zurich", "Africa/Abidjan", "Indian/Mayotte",
            "America/Martinique", "America/Guadeloupe",
        ],
    )


@app.route("/etape/2", methods=["GET", "POST"])
@verifier_verrou
def etape2_ports():
    """Étape 2 : Configuration des ports."""
    if "etape1" not in session:
        return redirect(url_for("etape1_identite"))

    prefixe = session["etape1"]["prefixe_conteneurs"]

    if request.method == "POST":
        donnees = request.form.to_dict()
        session["etape2"] = {
            "port_entree_plesk": int(donnees.get("port_entree_plesk", 3082)),
            "port_minio_api": int(donnees.get("port_minio_api", 9100)),
            "port_minio_console": int(donnees.get("port_minio_console", 9101)),
            "port_postgresql_local": int(donnees.get("port_postgresql_local", 5434)),
        }
        return redirect(url_for("etape3_base_de_donnees"))

    suggestions = ports_suggeres(prefixe)
    return render_template("etape2-ports.html",
        prefixe=prefixe,
        suggestions=suggestions,
        config=charger_configuration(),
    )


@app.route("/etape/3", methods=["GET", "POST"])
@verifier_verrou
def etape3_base_de_donnees():
    """Étape 3 : Base de données et services."""
    if "etape2" not in session:
        return redirect(url_for("etape2_ports"))

    config_existante = charger_configuration()
    prefixe = (
        session.get("etape1", {}).get("prefixe_conteneurs")
        or config_existante.get("prefixe_conteneurs")
        or PREFIXE_PAR_DEFAUT
    )

    if request.method == "POST":
        donnees = request.form.to_dict()
        session["etape3"] = {
            "bdd_nom": donnees.get("bdd_nom", bdd_nom_defaut(prefixe)),
            "bdd_utilisateur": donnees.get("bdd_utilisateur", bdd_utilisateur_defaut(prefixe)),
            "bdd_mot_de_passe": donnees.get("bdd_mot_de_passe", generer_secret(16)),
            "redis_mot_de_passe": donnees.get("redis_mot_de_passe", ""),
            "minio_acces_cle": donnees.get("minio_acces_cle", generer_secret(10)),
            "minio_secret_cle": donnees.get("minio_secret_cle", generer_secret(20)),
        }
        return redirect(url_for("etape4_courriel"))

    return render_template("etape3-base-de-donnees.html",
        config=config_existante,
        bdd_nom_defaut=bdd_nom_defaut(prefixe),
        bdd_utilisateur_defaut=bdd_utilisateur_defaut(prefixe),
        bdd_mdp_defaut=generer_secret(16),
        minio_cle_defaut=generer_secret(10),
        minio_secret_defaut=generer_secret(20),
    )


@app.route("/etape/4", methods=["GET", "POST"])
@verifier_verrou
def etape4_courriel():
    """Étape 4 : Configuration du courriel."""
    if "etape3" not in session:
        return redirect(url_for("etape3_base_de_donnees"))

    if request.method == "POST":
        donnees = request.form.to_dict()
        port_smtp = int(donnees.get("courriel_port_smtp", 587))
        session["etape4"] = {
            "courriel_hote_smtp": donnees.get("courriel_hote_smtp", ""),
            "courriel_port_smtp": port_smtp,
            "courriel_tls": donnees.get("courriel_tls", "true") == "true",
            "courriel_utilisateur": donnees.get("courriel_utilisateur", ""),
            "courriel_mot_de_passe": donnees.get("courriel_mot_de_passe", ""),
            "courriel_expediteur": donnees.get("courriel_expediteur", ""),
            "courriel_administrateur": donnees.get("courriel_administrateur", ""),
        }
        return redirect(url_for("etape5_administrateur"))

    return render_template("etape4-courriel.html", config=charger_configuration())


@app.route("/etape/5", methods=["GET", "POST"])
@verifier_verrou
def etape5_administrateur():
    """Étape 5 : Compte super-administrateur."""
    if "etape4" not in session:
        return redirect(url_for("etape4_courriel"))

    if request.method == "POST":
        donnees = request.form.to_dict()
        if donnees.get("admin_mot_de_passe") != donnees.get("admin_mot_de_passe_confirm"):
            return render_template("etape5-administrateur.html",
                erreur="Les mots de passe ne correspondent pas.",
                config=charger_configuration(),
            )
        session["etape5"] = {
            "admin_prenom": donnees.get("admin_prenom", ""),
            "admin_nom": donnees.get("admin_nom", ""),
            "admin_courriel": donnees.get("admin_courriel", ""),
            "admin_mot_de_passe": donnees.get("admin_mot_de_passe", ""),
        }
        return redirect(url_for("etape6_recapitulatif"))

    return render_template("etape5-administrateur.html", config=charger_configuration())


@app.route("/etape/6", methods=["GET", "POST"])
@verifier_verrou
def etape6_recapitulatif():
    """Étape 6 : Récapitulatif et lancement."""
    for etape in ["etape1", "etape2", "etape3", "etape4", "etape5"]:
        if etape not in session:
            return redirect(url_for("accueil"))

    prefixe = session["etape1"]["prefixe_conteneurs"]
    config_complete = {
        **session["etape1"],
        **session["etape2"],
        **session["etape3"],
        **session["etape4"],
        **session["etape5"],
        "secret_django": generer_secret(32),
        "secret_nextauth": generer_secret(32),
        "racine_projet": str(RACINE_PROJET),
        "racine_projet_hote": RACINE_PROJET_HOTE,
        **chemins_ressources_defaut(RACINE_PROJET_HOTE),
        "admin_url": ADMIN_URL_PAR_DEFAUT,
        "url_backend": f"http://{prefixe}-backend:8000",
        "date_installation": datetime.datetime.now().isoformat(),
    }

    if request.method == "POST":
        session["config_complete"] = config_complete
        return redirect(url_for("lancer_installation"))

    return render_template("etape6-recapitulatif.html",
        config=config_complete,
        session_etapes={k: v for k, v in session.items() if k.startswith("etape") and "mot_de_passe" not in str(v)},
    )


@app.route("/lancer", methods=["POST", "GET"])
@verifier_verrou
def lancer_installation():
    """Lance l'installation : génération des fichiers et démarrage Docker."""
    if "config_complete" not in session:
        return redirect(url_for("accueil"))

    config = session["config_complete"]
    return render_template("installation-en-cours.html", config=config)


# ------------------------------------------------------------
# Route de reprise — installation existante
# ------------------------------------------------------------
@app.route("/reprise", methods=["GET", "POST"])
@verifier_verrou
def reprise():
    """
    Page de reprise pour une installation existante.
    Permet de créer un compte administrateur sans relancer
    l'intégralité du processus d'installation.
    """
    plateforme = detecter_plateforme_existante()

    if request.method == "POST":
        donnees = request.form.to_dict()
        if donnees.get("admin_mot_de_passe") != donnees.get("admin_mot_de_passe_confirm"):
            return render_template("reprise.html",
                plateforme=plateforme,
                erreur="Les mots de passe ne correspondent pas.",
            )
        # Stocker pour que l'API puisse y accéder
        session["reprise_admin"] = {
            "prefixe": plateforme["prefixe"],
            "admin_prenom": donnees.get("admin_prenom", ""),
            "admin_nom": donnees.get("admin_nom", ""),
            "admin_courriel": donnees.get("admin_courriel", ""),
            "admin_mot_de_passe": donnees.get("admin_mot_de_passe", ""),
        }
        return render_template("reprise.html",
            plateforme=plateforme,
            lancer_creation=True,
        )

    return render_template("reprise.html", plateforme=plateforme, erreur=None)


# ------------------------------------------------------------
# API REST
# ------------------------------------------------------------

@app.route("/api/installer/etapes", methods=["POST"])
def api_executer_installation():
    """API appelée par le JavaScript de la page d'installation en cours."""
    if "config_complete" not in session:
        return jsonify({"succes": False, "erreur": "Configuration absente"})

    config = session["config_complete"]
    etape = request.json.get("etape", "")
    prefixe = config["prefixe_conteneurs"]

    if etape == "fichiers":
        resultats = ecrire_fichiers(config)
        if resultats["erreurs"]:
            return jsonify({"succes": False, "erreur": "; ".join(resultats["erreurs"])})
        return jsonify({"succes": True, "message": "Fichiers .env et compose.yaml générés avec succès."})

    elif etape == "volumes":
        try:
            creer_volumes(prefixe, str(RACINE_PROJET))
            return jsonify({"succes": True, "message": "Répertoires de volumes créés."})
        except Exception as e:
            return jsonify({"succes": False, "erreur": str(e)})

    elif etape == "construction":
        try:
            r = subprocess.run(
                ["docker", "compose", "-f", str(FICHIER_COMPOSE), "build", "--no-cache"],
                capture_output=True, text=True, timeout=600, cwd=str(RACINE_PROJET)
            )
            if r.returncode != 0:
                return jsonify({"succes": False, "erreur": r.stderr[-2000:]})
            return jsonify({"succes": True, "message": "Images Docker construites."})
        except subprocess.TimeoutExpired:
            return jsonify({"succes": False, "erreur": "Délai dépassé lors de la construction des images (10 min)."})
        except Exception as e:
            return jsonify({"succes": False, "erreur": str(e)})

    elif etape == "demarrage":
        try:
            r = subprocess.run(
                ["docker", "compose", "-f", str(FICHIER_COMPOSE), "up", "-d"],
                capture_output=True, text=True, timeout=120, cwd=str(RACINE_PROJET)
            )
            if r.returncode != 0:
                return jsonify({"succes": False, "erreur": r.stderr[-2000:]})
            return jsonify({"succes": True, "message": "Conteneurs démarrés."})
        except Exception as e:
            return jsonify({"succes": False, "erreur": str(e)})

    elif etape == "sante":
        # Attendre avec retry que les services critiques soient sains (max 5 minutes)
        SERVICES_CRITIQUES = [f"{prefixe}-postgresql", f"{prefixe}-redis", f"{prefixe}-backend"]
        MAX_TENTATIVES = 30   # 30 × 10s = 5 min
        DELAI_SEC = 10

        for tentative in range(MAX_TENTATIVES):
            time.sleep(DELAI_SEC)
            try:
                r = subprocess.run(
                    ["docker", "compose", "-f", str(FICHIER_COMPOSE), "ps", "--format", "json"],
                    capture_output=True, text=True, timeout=30, cwd=str(RACINE_PROJET)
                )
                if r.returncode == 0 and r.stdout.strip():
                    conteneurs = []
                    for ligne in r.stdout.strip().split("\n"):
                        if ligne.strip():
                            try:
                                conteneurs.append(json.loads(ligne))
                            except json.JSONDecodeError:
                                pass

                    # Vérifier les services critiques
                    critiques_sains = all(
                        any(
                            c.get("Name") == svc and "healthy" in c.get("Status", "").lower()
                            for c in conteneurs
                        )
                        for svc in SERVICES_CRITIQUES
                    )

                    if critiques_sains:
                        nb_sains = sum(1 for c in conteneurs if "healthy" in c.get("Status", "").lower())
                        return jsonify({
                            "succes": True,
                            "message": f"Services critiques opérationnels ({nb_sains}/{len(conteneurs)} sains, {tentative + 1} vérification(s)).",
                        })
            except Exception:
                pass

        # Délai dépassé — retourner l'état actuel sans bloquer la suite
        return jsonify({
            "succes": True,
            "message": "Délai de vérification dépassé — certains services secondaires démarrent encore. "
                       "Les migrations seront tentées ; elles échoueront si la base n'est pas prête.",
        })

    elif etape == "migrations":
        try:
            r = subprocess.run(
                ["docker", "compose", "-f", str(FICHIER_COMPOSE), "exec", "-T",
                 f"{prefixe}-backend", "python", "manage.py", "migrate", "--noinput"],
                capture_output=True, text=True, timeout=180, cwd=str(RACINE_PROJET)
            )
            if r.returncode != 0:
                return jsonify({"succes": False, "erreur": r.stderr[-2000:] or r.stdout[-1000:]})
            return jsonify({"succes": True, "message": "Migrations de base de données appliquées."})
        except subprocess.TimeoutExpired:
            return jsonify({"succes": False, "erreur": "Délai dépassé lors des migrations (3 min)."})
        except Exception as e:
            return jsonify({"succes": False, "erreur": str(e)})

    elif etape == "superadmin":
        resultat = executer_creation_admin(
            prefixe=prefixe,
            courriel=config["admin_courriel"],
            mot_de_passe=config["admin_mot_de_passe"],
            prenom=config["admin_prenom"],
            nom=config["admin_nom"],
        )
        return jsonify(resultat)

    elif etape == "verrou":
        FICHIER_VERROU.parent.mkdir(parents=True, exist_ok=True)
        with open(FICHIER_VERROU, "w") as f:
            json.dump({
                "date": datetime.datetime.now().isoformat(),
                "prefixe": config["prefixe_conteneurs"],
                "nom_plateforme": config["nom_plateforme"],
            }, f, ensure_ascii=False, indent=2)
        # Supprimer la config temporaire
        config_temp = RACINE_PROJET / "installateur" / ".configuration-en-cours.json"
        if config_temp.exists():
            config_temp.unlink()
        return jsonify({"succes": True, "message": "Installation verrouillée."})

    return jsonify({"succes": False, "erreur": f"Étape inconnue : {etape}"})


@app.route("/api/installer/admin-seulement", methods=["POST"])
def api_admin_seulement():
    """
    Crée un super-administrateur sur une installation existante
    (utilisé depuis la page de reprise).
    """
    if "reprise_admin" not in session:
        return jsonify({"succes": False, "erreur": "Données de reprise absentes."})

    donnees = session["reprise_admin"]
    resultat = executer_creation_admin(
        prefixe=donnees["prefixe"],
        courriel=donnees["admin_courriel"],
        mot_de_passe=donnees["admin_mot_de_passe"],
        prenom=donnees["admin_prenom"],
        nom=donnees["admin_nom"],
    )
    return jsonify(resultat)


@app.route("/api/etat-conteneurs")
def api_etat_conteneurs():
    """Retourne l'état en temps réel des conteneurs de la plateforme."""
    plateforme = detecter_plateforme_existante()
    return jsonify(plateforme)


@app.route("/api/verifier-port/<int:port>")
def api_verifier_port(port: int):
    libre = port_libre(port)
    avertissement = avertissement_port(port)
    return jsonify({
        "port": port,
        "libre": libre,
        "avertissement": avertissement,
        "utilisable": libre and avertissement is None,
    })


@app.route("/api/generer-secret")
def api_generer_secret():
    return jsonify({"secret": generer_secret(32)})


@app.route("/terminee")
def terminee():
    info = {}
    if FICHIER_VERROU.exists():
        try:
            with open(FICHIER_VERROU) as f:
                info = json.load(f)
        except Exception:
            pass
    return render_template("installation-terminee.html", info=info)


@app.route("/sante")
def sante():
    return jsonify({"statut": "operationnel", "installateur": True, "verrouille": installation_terminee()})


# ------------------------------------------------------------
if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Installateur de la plateforme LBH")
    parser.add_argument("--port", type=int, default=5099, help="Port d'écoute")
    parser.add_argument("--hote", default="0.0.0.0", help="Adresse d'écoute")
    args = parser.parse_args()

    if installation_terminee():
        print(f"\n[!] Installation déjà effectuée. Accéder à : http://localhost:{args.port}/terminee\n")

    print(f"\n{'='*60}")
    print(f"  INSTALLATEUR PLATEFORME LBH")
    print(f"  Accéder à : http://localhost:{args.port}")
    print(f"{'='*60}\n")

    app.run(host=args.hote, port=args.port, debug=False)
