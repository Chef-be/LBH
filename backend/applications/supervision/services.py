"""Services utilitaires pour la supervision temps réel."""

from __future__ import annotations

import http.client
import json
import os
import socket
import ssl
import time
from dataclasses import dataclass
from decimal import Decimal
from email.utils import formataddr
from smtplib import SMTP, SMTP_SSL
from typing import Any

from django.conf import settings
from django.utils import timezone


DOCKER_SOCKET_PATH = "/var/run/docker.sock"
HOST_PROC_PATH = os.environ.get("SUPERVISION_HOST_PROC_PATH", "/host_proc")
HOST_FS_PATH = os.environ.get("SUPERVISION_HOST_FS_PATH", "/hostfs")


class DockerUnavailableError(RuntimeError):
    """Le socket Docker n'est pas accessible."""


class UnixSocketHTTPConnection(http.client.HTTPConnection):
    def __init__(self, socket_path: str):
        super().__init__("localhost", timeout=3)
        self.socket_path = socket_path

    def connect(self):
        self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.sock.settimeout(3)
        self.sock.connect(self.socket_path)


@dataclass
class ResultatTestSMTP:
    succes: bool
    detail: str
    latence_ms: int


def _lire_fichier(chemin: str) -> str:
    with open(chemin, "r", encoding="utf-8") as fichier:
        return fichier.read()


def _lire_cpu_pct_hote() -> Decimal:
    chemin = os.path.join(HOST_PROC_PATH, "stat")
    if not os.path.exists(chemin):
        raise FileNotFoundError(chemin)

    def lire() -> tuple[int, int]:
        ligne = _lire_fichier(chemin).splitlines()[0]
        champs = [int(valeur) for valeur in ligne.split()[1:]]
        total = sum(champs)
        idle = champs[3] + (champs[4] if len(champs) > 4 else 0)
        return total, idle

    total_1, idle_1 = lire()
    time.sleep(0.2)
    total_2, idle_2 = lire()
    delta_total = max(total_2 - total_1, 1)
    delta_idle = max(idle_2 - idle_1, 0)
    utilisation = max(0.0, min(100.0, 100.0 * (1 - (delta_idle / delta_total))))
    return Decimal(f"{utilisation:.2f}")


def _lire_meminfo_hote() -> dict[str, int]:
    chemin = os.path.join(HOST_PROC_PATH, "meminfo")
    if not os.path.exists(chemin):
        raise FileNotFoundError(chemin)

    valeurs: dict[str, int] = {}
    for ligne in _lire_fichier(chemin).splitlines():
        if ":" not in ligne:
            continue
        cle, valeur = ligne.split(":", 1)
        brut = valeur.strip().split()[0]
        try:
            valeurs[cle] = int(brut) * 1024
        except ValueError:
            continue
    return valeurs


def _lire_loadavg_hote() -> tuple[Decimal | None, Decimal | None, Decimal | None]:
    chemin = os.path.join(HOST_PROC_PATH, "loadavg")
    if not os.path.exists(chemin):
        return None, None, None
    champs = _lire_fichier(chemin).strip().split()
    if len(champs) < 3:
        return None, None, None
    return (
        Decimal(champs[0]),
        Decimal(champs[1]),
        Decimal(champs[2]),
    )


def _lire_uptime_hote() -> int | None:
    chemin = os.path.join(HOST_PROC_PATH, "uptime")
    if not os.path.exists(chemin):
        return None
    try:
        return int(float(_lire_fichier(chemin).split()[0]))
    except (ValueError, IndexError):
        return None


def _lire_disque_hote() -> tuple[int | None, int | None, Decimal | None]:
    cible = HOST_FS_PATH if os.path.exists(HOST_FS_PATH) else "/"
    stats = os.statvfs(cible)
    total = stats.f_blocks * stats.f_frsize
    libre = stats.f_bavail * stats.f_frsize
    utilise = max(total - libre, 0)
    if total <= 0:
        return None, None, None
    pourcentage = Decimal(f"{(utilise / total) * 100:.2f}")
    return total, utilise, pourcentage


def capturer_metriques_serveur() -> dict[str, Any]:
    source = "hote" if os.path.exists(HOST_PROC_PATH) else "conteneur"

    try:
        charge_cpu_pct = _lire_cpu_pct_hote()
        meminfo = _lire_meminfo_hote()
        charge_1m, charge_5m, charge_15m = _lire_loadavg_hote()
        uptime_secondes = _lire_uptime_hote()
    except FileNotFoundError:
        import psutil

        source = "conteneur"
        charge_cpu_pct = Decimal(f"{psutil.cpu_percent(interval=0.2):.2f}")
        mem = psutil.virtual_memory()
        meminfo = {
            "MemTotal": int(mem.total),
            "MemAvailable": int(mem.available),
        }
        charge_tuple = os.getloadavg() if hasattr(os, "getloadavg") else (0.0, 0.0, 0.0)
        charge_1m, charge_5m, charge_15m = (
            Decimal(f"{charge_tuple[0]:.2f}"),
            Decimal(f"{charge_tuple[1]:.2f}"),
            Decimal(f"{charge_tuple[2]:.2f}"),
        )
        uptime_secondes = None

    memoire_totale = meminfo.get("MemTotal")
    memoire_disponible = meminfo.get("MemAvailable")
    memoire_utilisee = (
        memoire_totale - memoire_disponible
        if memoire_totale is not None and memoire_disponible is not None
        else None
    )
    memoire_pct = (
        Decimal(f"{(memoire_utilisee / memoire_totale) * 100:.2f}")
        if memoire_totale and memoire_utilisee is not None
        else Decimal("0.00")
    )

    disque_total, disque_utilise, disque_pct = _lire_disque_hote()

    return {
        "charge_cpu_pct": charge_cpu_pct,
        "memoire_pct": memoire_pct,
        "disque_pct": disque_pct or Decimal("0.00"),
        "charge_moyenne_1m": charge_1m,
        "charge_moyenne_5m": charge_5m,
        "charge_moyenne_15m": charge_15m,
        "memoire_totale_octets": memoire_totale,
        "memoire_utilisee_octets": memoire_utilisee,
        "disque_total_octets": disque_total,
        "disque_utilise_octets": disque_utilise,
        "details": {
            "source": source,
            "uptime_secondes": uptime_secondes,
        },
    }


def enregistrer_instantane_serveur_si_necessaire(snapshot: dict[str, Any]):
    from .models import InstantaneServeur

    dernier = InstantaneServeur.objects.order_by("-horodatage").first()
    maintenant = timezone.now()
    if dernier and (maintenant - dernier.horodatage).total_seconds() < 300:
        return InstantaneServeur(horodatage=maintenant, **snapshot)
    return InstantaneServeur.objects.create(**snapshot)


def _requete_docker_json(chemin: str) -> Any:
    if not os.path.exists(DOCKER_SOCKET_PATH):
        raise DockerUnavailableError("Le socket Docker n'est pas monté dans le conteneur backend.")

    connexion = UnixSocketHTTPConnection(DOCKER_SOCKET_PATH)
    try:
        connexion.request("GET", chemin)
        reponse = connexion.getresponse()
        contenu = reponse.read().decode("utf-8")
        if reponse.status >= 400:
            raise DockerUnavailableError(f"API Docker indisponible: {reponse.status} {reponse.reason}")
        return json.loads(contenu)
    finally:
        connexion.close()


def lister_conteneurs_docker() -> list[dict[str, Any]]:
    prefixe = getattr(settings, "PREFIXE_CONTENEURS", os.environ.get("PREFIXE_CONTENEURS", "lbh"))
    conteneurs = _requete_docker_json("/containers/json?all=1")
    resultat: list[dict[str, Any]] = []

    for conteneur in conteneurs:
        labels = conteneur.get("Labels") or {}
        projet = labels.get("com.docker.compose.project")
        noms = conteneur.get("Names") or []
        nom = noms[0].lstrip("/") if noms else conteneur.get("Id", "")[:12]

        if projet and projet != prefixe:
            continue
        if not projet and not nom.startswith(f"{prefixe}-"):
            continue

        inspect = _requete_docker_json(f"/containers/{conteneur['Id']}/json")
        etat = inspect.get("State") or {}
        health = etat.get("Health") or {}
        ports_bruts = conteneur.get("Ports") or []
        ports = []
        for port in ports_bruts:
            port_hote = port.get("PublicPort")
            if port_hote:
                ports.append(f"{port_hote}->{port.get('PrivatePort')}/{port.get('Type')}")
            else:
                ports.append(f"{port.get('PrivatePort')}/{port.get('Type')}")

        resultat.append({
            "id": conteneur["Id"][:12],
            "nom": nom,
            "service": labels.get("com.docker.compose.service") or nom.removeprefix(f"{prefixe}-"),
            "image": conteneur.get("Image"),
            "etat": etat.get("Status") or conteneur.get("State"),
            "statut": conteneur.get("Status"),
            "sante": health.get("Status") or ("healthy" if etat.get("Running") else "stopped"),
            "redemarrages": inspect.get("RestartCount", 0),
            "demarre_le": etat.get("StartedAt"),
            "cree_le": inspect.get("Created"),
            "ports": ports,
        })

    return sorted(resultat, key=lambda item: item["nom"])


def synthese_services(conteneurs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    services: list[dict[str, Any]] = []
    for conteneur in conteneurs:
        sante = conteneur["sante"]
        etat = conteneur["etat"]
        niveau = "nominal"
        statut = "ok"
        if etat != "running":
            niveau = "critique"
            statut = "ko"
        elif sante in {"unhealthy", "starting"}:
            niveau = "avertissement"
            statut = "alerte"

        services.append({
            "code": conteneur["service"],
            "nom": conteneur["service"].replace("-", " ").title(),
            "statut": statut,
            "niveau": niveau,
            "message": conteneur["statut"],
            "sante": sante,
            "derniere_verification": timezone.now().isoformat(),
            "conteneur": conteneur["nom"],
        })
    return services


def tester_configuration_smtp(configuration: dict[str, Any]) -> ResultatTestSMTP:
    chiffrement = configuration.get("chiffrement") or "starttls"
    hote = configuration.get("hote") or "localhost"
    port = int(configuration.get("port") or (465 if chiffrement == "ssl_tls" else 587))
    utilisateur = configuration.get("utilisateur") or ""
    mot_de_passe = configuration.get("mot_de_passe") or ""
    expediteur = configuration.get("expediteur_defaut") or ""
    delai = int(configuration.get("delai_connexion") or 15)
    verifier_certificat = bool(configuration.get("verifier_certificat", True))

    contexte_ssl = ssl.create_default_context()
    if not verifier_certificat:
        contexte_ssl.check_hostname = False
        contexte_ssl.verify_mode = ssl.CERT_NONE

    debut = time.perf_counter()
    client: SMTP | SMTP_SSL | None = None
    try:
        if chiffrement == "ssl_tls":
            client = SMTP_SSL(hote, port, timeout=delai, context=contexte_ssl)
        else:
            client = SMTP(hote, port, timeout=delai)
            client.ehlo()
            if chiffrement == "starttls":
                client.starttls(context=contexte_ssl)

        client.ehlo()
        if utilisateur:
            client.login(utilisateur, mot_de_passe)

        if expediteur:
            formataddr((getattr(settings, "NOM_PLATEFORME", "LBH Economiste"), expediteur))

        detail = "Connexion SMTP réussie."
        if utilisateur:
            detail += " Authentification validée."
        latence_ms = int((time.perf_counter() - debut) * 1000)
        return ResultatTestSMTP(succes=True, detail=detail, latence_ms=latence_ms)
    finally:
        if client is not None:
            try:
                client.quit()
            except Exception:
                pass
