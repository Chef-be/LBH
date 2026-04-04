"""Services partagés de messagerie sortante, entrante et webmail."""

from __future__ import annotations

import mimetypes
import secrets
import smtplib
import ssl
import unicodedata
import re
from dataclasses import asdict, dataclass
from datetime import timedelta
from email import policy
from email.header import decode_header, make_header
from email.message import EmailMessage
from email.parser import BytesParser
from email.utils import getaddresses, make_msgid, parseaddr
from typing import Any

from django.conf import settings
from django.core.cache import cache
from django.utils.html import strip_tags
from django.utils import timezone
from imapclient import IMAPClient

from applications.messagerie.models import JournalCourriel
from applications.supervision.models import ServeurMail


DUREE_SESSION_WEBMAIL = 8 * 60 * 60
PREFIXE_CACHE_WEBMAIL = "messagerie:webmail:"


class MessagerieErreur(RuntimeError):
    """Erreur levée lors d'une opération de messagerie."""


@dataclass
class ConfigurationSMTP:
    nom: str
    hote: str
    port: int
    chiffrement: str
    utilisateur: str
    mot_de_passe: str
    expediteur_defaut: str
    reponse_a: str
    delai_connexion: int
    verifier_certificat: bool


@dataclass
class ConfigurationIMAP:
    nom: str
    hote: str
    port: int
    chiffrement: str
    utilisateur: str
    mot_de_passe: str
    delai_connexion: int
    verifier_certificat: bool
    dossier_envoyes: str
    dossier_brouillons: str
    dossier_archives: str
    dossier_indesirables: str
    dossier_corbeille: str


def _configuration_env_smtp() -> ConfigurationSMTP:
    chiffrement = "ssl_tls" if settings.EMAIL_USE_SSL else "starttls" if settings.EMAIL_USE_TLS else "aucun"
    expediteur = settings.DEFAULT_FROM_EMAIL or settings.EMAIL_HOST_USER
    if "<" in expediteur and ">" in expediteur:
        expediteur = parseaddr(expediteur)[1]
    return ConfigurationSMTP(
        nom="Configuration environnement",
        hote=settings.EMAIL_HOST,
        port=int(settings.EMAIL_PORT),
        chiffrement=chiffrement,
        utilisateur=settings.EMAIL_HOST_USER or "",
        mot_de_passe=settings.EMAIL_HOST_PASSWORD or "",
        expediteur_defaut=expediteur or "",
        reponse_a="",
        delai_connexion=int(getattr(settings, "COURRIEL_DELAI_CONNEXION", 15)),
        verifier_certificat=True,
    )


def _configuration_env_imap() -> ConfigurationIMAP:
    chiffrement = "ssl_tls" if getattr(settings, "COURRIEL_IMAP_SSL", True) else "starttls" if getattr(settings, "COURRIEL_IMAP_STARTTLS", False) else "aucun"
    return ConfigurationIMAP(
        nom="Configuration environnement",
        hote=getattr(settings, "COURRIEL_HOTE_IMAP", settings.EMAIL_HOST),
        port=int(getattr(settings, "COURRIEL_PORT_IMAP", 993)),
        chiffrement=chiffrement,
        utilisateur=settings.EMAIL_HOST_USER or "",
        mot_de_passe=settings.EMAIL_HOST_PASSWORD or "",
        delai_connexion=int(getattr(settings, "COURRIEL_DELAI_CONNEXION", 15)),
        verifier_certificat=bool(getattr(settings, "COURRIEL_IMAP_VERIFIER_CERTIFICAT", True)),
        dossier_envoyes=getattr(settings, "COURRIEL_DOSSIER_ENVOYES", "Sent"),
        dossier_brouillons=getattr(settings, "COURRIEL_DOSSIER_BROUILLONS", "Drafts"),
        dossier_archives=getattr(settings, "COURRIEL_DOSSIER_ARCHIVES", "Archive"),
        dossier_indesirables=getattr(settings, "COURRIEL_DOSSIER_INDESIRABLES", "Spam"),
        dossier_corbeille=getattr(settings, "COURRIEL_DOSSIER_CORBEILLE", "Trash"),
    )


def _requete_serveurs_mail(usage: str | None = None):
    requete = ServeurMail.objects.filter(est_actif=True)
    if usage == "notifications":
        requete = requete.filter(usage_notifications=True)
    elif usage == "plateforme":
        requete = requete.filter(usage_envoi_plateforme=True)
    return requete.order_by("-est_defaut", "nom")


def obtenir_configuration_smtp(usage: str | None = None, serveur_id: str | None = None) -> ConfigurationSMTP:
    if serveur_id:
        serveur = ServeurMail.objects.filter(pk=serveur_id, est_actif=True).first()
    else:
        serveur = _requete_serveurs_mail(usage=usage).first()

    if not serveur:
        return _configuration_env_smtp()

    expediteur = serveur.expediteur_defaut or serveur.utilisateur or _configuration_env_smtp().expediteur_defaut
    return ConfigurationSMTP(
        nom=serveur.nom,
        hote=serveur.hote,
        port=int(serveur.port),
        chiffrement=serveur.chiffrement,
        utilisateur=serveur.utilisateur or "",
        mot_de_passe=serveur.mot_de_passe or "",
        expediteur_defaut=expediteur or "",
        reponse_a=serveur.reponse_a or "",
        delai_connexion=int(serveur.delai_connexion),
        verifier_certificat=bool(serveur.verifier_certificat),
    )


def obtenir_configuration_imap(serveur_id: str | None = None) -> ConfigurationIMAP:
    if serveur_id:
        serveur = ServeurMail.objects.filter(pk=serveur_id, est_actif=True).first()
    else:
        serveur = _requete_serveurs_mail(usage="plateforme").first() or _requete_serveurs_mail().first()

    if not serveur:
        return _configuration_env_imap()

    env = _configuration_env_imap()
    return ConfigurationIMAP(
        nom=serveur.nom,
        hote=serveur.imap_hote or env.hote or serveur.hote,
        port=int(serveur.imap_port or env.port),
        chiffrement=serveur.imap_chiffrement or env.chiffrement,
        utilisateur=serveur.imap_utilisateur or serveur.utilisateur or env.utilisateur,
        mot_de_passe=serveur.imap_mot_de_passe or serveur.mot_de_passe or env.mot_de_passe,
        delai_connexion=int(serveur.delai_connexion or env.delai_connexion),
        verifier_certificat=bool(serveur.imap_verifier_certificat if serveur.imap_hote else env.verifier_certificat),
        dossier_envoyes=serveur.imap_dossier_envoyes or env.dossier_envoyes,
        dossier_brouillons=serveur.imap_dossier_brouillons or env.dossier_brouillons,
        dossier_archives=serveur.imap_dossier_archives or env.dossier_archives,
        dossier_indesirables=serveur.imap_dossier_indesirables or env.dossier_indesirables,
        dossier_corbeille=serveur.imap_dossier_corbeille or env.dossier_corbeille,
    )


def _contexte_ssl(verifier_certificat: bool) -> ssl.SSLContext:
    contexte = ssl.create_default_context()
    if not verifier_certificat:
        contexte.check_hostname = False
        contexte.verify_mode = ssl.CERT_NONE
    return contexte


def _journaliser_courriel(
    *,
    utilisateur=None,
    origine: str,
    statut: str,
    sujet: str,
    expediteur: str,
    destinataires: list[str],
    copie: list[str] | None,
    copie_cachee: list[str] | None,
    message_id: str = "",
    erreur: str = "",
    contexte: dict[str, Any] | None = None,
    nombre_pieces_jointes: int = 0,
):
    JournalCourriel.objects.create(
        utilisateur=utilisateur,
        origine=origine,
        statut=statut,
        sujet=sujet[:255],
        expediteur=expediteur,
        destinataires=destinataires,
        copie=copie or [],
        copie_cachee=copie_cachee or [],
        message_id=message_id,
        erreur=erreur,
        contexte=contexte or {},
        nombre_pieces_jointes=nombre_pieces_jointes,
    )


def envoyer_courriel(
    *,
    sujet: str,
    destinataires: list[str],
    copie: list[str] | None = None,
    copie_cachee: list[str] | None = None,
    corps_texte: str,
    corps_html: str | None = None,
    expediteur: str | None = None,
    reponse_a: list[str] | None = None,
    configuration: ConfigurationSMTP | None = None,
    pieces_jointes: list[dict[str, Any]] | None = None,
    utilisateur=None,
    origine: str = "plateforme",
    contexte_journal: dict[str, Any] | None = None,
) -> dict[str, Any]:
    config = configuration or obtenir_configuration_smtp(usage="plateforme")
    expediteur_effectif = expediteur or config.expediteur_defaut or config.utilisateur
    if not expediteur_effectif:
        raise MessagerieErreur("Aucun expéditeur n'est configuré pour l'envoi de courriel.")

    message = EmailMessage()
    message["Subject"] = sujet
    message["From"] = expediteur_effectif
    message["To"] = ", ".join(destinataires)
    if copie:
        message["Cc"] = ", ".join(copie)
    if reponse_a:
        message["Reply-To"] = ", ".join(reponse_a)
    message["Message-ID"] = make_msgid(domain=(expediteur_effectif.split("@", 1)[1] if "@" in expediteur_effectif else None))
    message.set_content(corps_texte)
    if corps_html:
        message.add_alternative(corps_html, subtype="html")

    for piece in pieces_jointes or []:
        contenu = piece["contenu"]
        type_mime = piece.get("type_mime") or mimetypes.guess_type(piece.get("nom", ""))[0] or "application/octet-stream"
        type_principal, sous_type = type_mime.split("/", 1)
        message.add_attachment(
            contenu,
            maintype=type_principal,
            subtype=sous_type,
            filename=piece.get("nom") or "piece-jointe",
        )

    contexte = _contexte_ssl(config.verifier_certificat)
    client: smtplib.SMTP | smtplib.SMTP_SSL | None = None
    try:
        if config.chiffrement == "ssl_tls":
            client = smtplib.SMTP_SSL(config.hote, config.port, timeout=config.delai_connexion, context=contexte)
        else:
            client = smtplib.SMTP(config.hote, config.port, timeout=config.delai_connexion)
            client.ehlo()
            if config.chiffrement == "starttls":
                client.starttls(context=contexte)
        client.ehlo()
        if config.utilisateur:
            client.login(config.utilisateur, config.mot_de_passe)
        client.send_message(
            message,
            to_addrs=destinataires + (copie or []) + (copie_cachee or []),
        )
    except Exception as exc:
        _journaliser_courriel(
            utilisateur=utilisateur,
            origine=origine,
            statut="echec",
            sujet=sujet,
            expediteur=expediteur_effectif,
            destinataires=destinataires,
            copie=copie,
            copie_cachee=copie_cachee,
            erreur=str(exc),
            contexte=contexte_journal,
            nombre_pieces_jointes=len(pieces_jointes or []),
        )
        raise MessagerieErreur(str(exc)) from exc
    finally:
        if client is not None:
            try:
                client.quit()
            except Exception:
                pass

    _journaliser_courriel(
        utilisateur=utilisateur,
        origine=origine,
        statut="succes",
        sujet=sujet,
        expediteur=expediteur_effectif,
        destinataires=destinataires,
        copie=copie,
        copie_cachee=copie_cachee,
        message_id=message["Message-ID"],
        contexte=contexte_journal,
        nombre_pieces_jointes=len(pieces_jointes or []),
    )

    return {
        "message_id": message["Message-ID"],
        "expediteur": expediteur_effectif,
        "destinataires": destinataires + (copie or []) + (copie_cachee or []),
    }


def creer_session_webmail(*, utilisateur_id: str, courriel: str, mot_de_passe: str, serveur_id: str | None = None, smtp: dict[str, Any] | None = None, imap: dict[str, Any] | None = None, nom_affiche: str = "") -> dict[str, Any]:
    config_smtp = obtenir_configuration_smtp(serveur_id=serveur_id)
    config_imap = obtenir_configuration_imap(serveur_id=serveur_id)

    if smtp:
        for cle, valeur in smtp.items():
            if hasattr(config_smtp, cle) and valeur not in (None, ""):
                setattr(config_smtp, cle, valeur)
    if imap:
        for cle, valeur in imap.items():
            if hasattr(config_imap, cle) and valeur not in (None, ""):
                setattr(config_imap, cle, valeur)

    if not config_smtp.expediteur_defaut:
        config_smtp.expediteur_defaut = courriel
    if not config_smtp.reponse_a:
        config_smtp.reponse_a = courriel

    config_imap.utilisateur = courriel
    config_imap.mot_de_passe = mot_de_passe

    with connexion_imap(config_imap):
        pass

    jeton = secrets.token_urlsafe(32)
    expire_le = timezone.now() + timedelta(seconds=DUREE_SESSION_WEBMAIL)
    donnees = {
        "utilisateur_id": str(utilisateur_id),
        "courriel": courriel,
        "nom_affiche": nom_affiche or courriel,
        "serveur_id": serveur_id,
        "smtp": asdict(config_smtp),
        "imap": asdict(config_imap),
        "expire_le": expire_le.isoformat(),
    }
    cache.set(f"{PREFIXE_CACHE_WEBMAIL}{jeton}", donnees, DUREE_SESSION_WEBMAIL)
    return {
        "jeton": jeton,
        "expire_le": expire_le.isoformat(),
        "compte": {"courriel": courriel, "nom_affiche": donnees["nom_affiche"]},
    }


def obtenir_session_webmail(jeton: str, utilisateur_id: str) -> dict[str, Any]:
    donnees = cache.get(f"{PREFIXE_CACHE_WEBMAIL}{jeton}")
    if not donnees:
        raise MessagerieErreur("La session webmail est expirée ou introuvable.")
    if donnees.get("utilisateur_id") != str(utilisateur_id):
        raise MessagerieErreur("Cette session webmail n'appartient pas à cet utilisateur.")
    return donnees


def fermer_session_webmail(jeton: str):
    cache.delete(f"{PREFIXE_CACHE_WEBMAIL}{jeton}")


class connexion_imap:
    def __init__(self, configuration: ConfigurationIMAP):
        self.configuration = configuration
        self.client: IMAPClient | None = None

    def __enter__(self) -> IMAPClient:
        contexte = _contexte_ssl(self.configuration.verifier_certificat)
        self.client = IMAPClient(
            self.configuration.hote,
            port=self.configuration.port,
            ssl=self.configuration.chiffrement == "ssl_tls",
            ssl_context=contexte,
            timeout=self.configuration.delai_connexion,
        )
        if self.configuration.chiffrement == "starttls":
            self.client.starttls(ssl_context=contexte)
        self.client.login(self.configuration.utilisateur, self.configuration.mot_de_passe)
        return self.client

    def __exit__(self, exc_type, exc, tb):
        if self.client is not None:
            try:
                self.client.logout()
            except Exception:
                pass


def _texte_normalise(valeur: Any) -> str:
    if valeur is None:
        return ""
    if isinstance(valeur, bytes):
        return valeur.decode(errors="replace")
    return str(valeur)


def _decoder_entete_mime(valeur: Any) -> str:
    texte = _texte_normalise(valeur)
    if not texte:
        return ""
    try:
        return str(make_header(decode_header(texte)))
    except Exception:
        return texte


def _semble_contenir_html(valeur: str) -> bool:
    texte = (valeur or "").strip().lower()
    if not texte:
        return False
    if texte.startswith("<!doctype html") or texte.startswith("<html") or texte.startswith("<body"):
        return True
    return bool(
        re.search(
            r"<(html|head|body|table|tr|td|div|p|span|br|a|img|style|meta)\b",
            texte,
        )
        and re.search(r"</(html|body|table|tr|td|div|p|span|a)>", texte)
    )


def _decoder_liste_adresses(valeurs: list[Any]) -> list[dict[str, str]]:
    resultat: list[dict[str, str]] = []
    for valeur in valeurs or []:
        nom = ""
        boite = ""
        domaine = ""
        if isinstance(valeur, (tuple, list)):
            elements = list(valeur) + ["", "", "", ""]
            nom, _, boite, domaine = elements[:4]
        else:
            nom = getattr(valeur, "name", "")
            boite = getattr(valeur, "mailbox", "") or getattr(valeur, "box", "")
            domaine = getattr(valeur, "host", "") or getattr(valeur, "domain", "")
        nom = _decoder_entete_mime(nom)
        boite = _texte_normalise(boite)
        domaine = _texte_normalise(domaine)
        if not boite or not domaine:
            continue
        resultat.append(
            {
                "nom": nom,
                "adresse": f"{boite}@{domaine}",
            }
        )
    return resultat


def _adresse_principale(valeurs: list[dict[str, str]]) -> str:
    if not valeurs:
        return ""
    principal = valeurs[0]
    return principal["nom"] or principal["adresse"]


def _normaliser_nom_dossier(nom: str) -> str:
    texte = unicodedata.normalize("NFKD", nom or "")
    texte = "".join(caractere for caractere in texte if not unicodedata.combining(caractere))
    return " ".join(texte.lower().replace("_", " ").split())


def _candidats_dossier_envoyes(configure: str, dossiers: list[dict[str, Any]]) -> list[str]:
    candidats: list[str] = []
    deja_vus: set[str] = set()

    def ajouter(nom: str):
        if nom and nom not in deja_vus:
            deja_vus.add(nom)
            candidats.append(nom)

    ajouter(configure)
    separateur_defaut = "."
    for dossier in dossiers:
        nom = dossier.get("nom") or ""
        drapeaux = {str(drapeau).lower() for drapeau in dossier.get("drapeaux", [])}
        separateur = dossier.get("separateur") or "."
        separateur_defaut = separateur or separateur_defaut
        if "\\sent" in drapeaux:
            ajouter(nom)

    nom_normalise = _normaliser_nom_dossier(configure)
    for dossier in dossiers:
        nom = dossier.get("nom") or ""
        normalise = _normaliser_nom_dossier(nom)
        base = _normaliser_nom_dossier(nom.split(dossier.get("separateur") or ".")[-1])
        if normalise == nom_normalise or base == nom_normalise:
            ajouter(nom)

    libelles_envoyes = {
        "sent",
        "sent items",
        "sent messages",
        "messages envoyes",
        "elements envoyes",
        "courrier envoye",
        "envoyes",
    }
    for dossier in dossiers:
        nom = dossier.get("nom") or ""
        separateur = dossier.get("separateur") or separateur_defaut
        base = _normaliser_nom_dossier(nom.split(separateur)[-1])
        if base in libelles_envoyes:
            ajouter(nom)

    if configure and not configure.upper().startswith("INBOX"):
        ajouter(f"INBOX{separateur_defaut}{configure}")
        if separateur_defaut != "/":
            ajouter(f"INBOX/{configure}")
        if separateur_defaut != ".":
            ajouter(f"INBOX.{configure}")

    return candidats


def _lister_dossiers_imap(client: IMAPClient) -> list[dict[str, Any]]:
    try:
        return [
            {
                "nom": nom,
                "separateur": separateur,
                "drapeaux": [d.decode() if isinstance(d, bytes) else str(d) for d in drapeaux],
            }
            for drapeaux, separateur, nom in client.list_folders()
        ]
    except Exception:
        return []


def lister_dossiers_webmail(session: dict[str, Any]) -> list[dict[str, Any]]:
    config = ConfigurationIMAP(**session["imap"])
    with connexion_imap(config) as client:
        dossiers = []
        for drapeaux, separateur, nom in client.list_folders():
            dossiers.append(
                {
                    "nom": nom,
                    "separateur": separateur,
                    "drapeaux": [d.decode() if isinstance(d, bytes) else str(d) for d in drapeaux],
                }
            )
        return dossiers


def lister_messages_webmail(session: dict[str, Any], dossier: str = "INBOX", page: int = 1, page_size: int = 25, recherche: str = "") -> dict[str, Any]:
    config = ConfigurationIMAP(**session["imap"])
    with connexion_imap(config) as client:
        client.select_folder(dossier, readonly=True)
        criteres: list[Any] = ["ALL"]
        if recherche:
            criteres = ["TEXT", recherche]
        uids = client.search(criteres)
        uids = list(reversed(uids))
        total = len(uids)
        debut = max((page - 1) * page_size, 0)
        fin = debut + page_size
        selection = uids[debut:fin]
        if not selection:
            return {"count": total, "results": [], "page": page, "page_size": page_size}

        donnees = client.fetch(selection, ["ENVELOPE", "FLAGS", "INTERNALDATE", "RFC822.SIZE"])
        messages = []
        for uid in selection:
            contenu = donnees.get(uid, {})
            enveloppe = contenu.get(b"ENVELOPE")
            expediteurs = _decoder_liste_adresses(getattr(enveloppe, "from_", None))
            destinataires = _decoder_liste_adresses(getattr(enveloppe, "to", None))
            sujet = _decoder_entete_mime(getattr(enveloppe, "subject", b"") or b"")
            flags = [flag.decode() if isinstance(flag, bytes) else str(flag) for flag in contenu.get(b"FLAGS", [])]
            messages.append(
                {
                    "uid": int(uid),
                    "sujet": sujet or "(Sans objet)",
                    "expediteur": expediteurs,
                    "expediteur_resume": _adresse_principale(expediteurs),
                    "destinataires": destinataires,
                    "date": contenu.get(b"INTERNALDATE").isoformat() if contenu.get(b"INTERNALDATE") else None,
                    "taille_octets": int(contenu.get(b"RFC822.SIZE", 0)),
                    "lu": "\\Seen" in flags,
                    "drapeaux": flags,
                }
            )
        return {"count": total, "results": messages, "page": page, "page_size": page_size}


def _extraire_corps(message) -> dict[str, str]:
    corps_texte = ""
    corps_html = ""
    pieces_jointes: list[dict[str, Any]] = []

    if message.is_multipart():
        for part in message.walk():
            disposition = part.get_content_disposition()
            if disposition == "attachment":
                pieces_jointes.append(
                    {
                        "nom": part.get_filename(),
                        "type_mime": part.get_content_type(),
                        "taille_octets": len(part.get_payload(decode=True) or b""),
                    }
                )
                continue
            if part.get_content_maintype() == "multipart":
                continue
            contenu = part.get_payload(decode=True) or b""
            try:
                texte = contenu.decode(part.get_content_charset() or "utf-8", errors="replace")
            except LookupError:
                texte = contenu.decode("utf-8", errors="replace")
            if part.get_content_type() == "text/plain" and not corps_texte:
                corps_texte = texte
            elif part.get_content_type() == "text/html" and not corps_html:
                corps_html = texte
    else:
        contenu = message.get_payload(decode=True) or b""
        corps_texte = contenu.decode(message.get_content_charset() or "utf-8", errors="replace")

    if not corps_html and _semble_contenir_html(corps_texte):
        corps_html = corps_texte
        corps_texte = strip_tags(corps_html).strip()

    return {"texte": corps_texte, "html": corps_html, "pieces_jointes": pieces_jointes}


def lire_message_webmail(session: dict[str, Any], dossier: str, uid: int) -> dict[str, Any]:
    config = ConfigurationIMAP(**session["imap"])
    with connexion_imap(config) as client:
        client.select_folder(dossier, readonly=False)
        donnees = client.fetch([uid], ["RFC822", "FLAGS", "ENVELOPE", "RFC822.SIZE"])
        contenu = donnees.get(uid)
        if not contenu:
            raise MessagerieErreur("Message introuvable.")
        message = BytesParser(policy=policy.default).parsebytes(contenu[b"RFC822"])
        enveloppe = contenu[b"ENVELOPE"]
        expediteurs = _decoder_liste_adresses(getattr(enveloppe, "from_", None))
        destinataires = _decoder_liste_adresses(getattr(enveloppe, "to", None))
        copie = _decoder_liste_adresses(getattr(enveloppe, "cc", None))
        repondre_a = [adresse for _, adresse in getaddresses(message.get_all("Reply-To", []))]
        corps = _extraire_corps(message)
        client.add_flags([uid], [b"\\Seen"])
        return {
            "uid": int(uid),
            "sujet": _decoder_entete_mime(message.get("Subject")) or "(Sans objet)",
            "expediteur": expediteurs,
            "destinataires": destinataires,
            "copie": copie,
            "repondre_a": repondre_a,
            "date": message.get("Date"),
            "taille_octets": int(contenu.get(b"RFC822.SIZE", 0)),
            "corps_texte": corps["texte"],
            "corps_html": corps["html"],
            "pieces_jointes": corps["pieces_jointes"],
        }


def basculer_message_lu(session: dict[str, Any], dossier: str, uid: int, lu: bool) -> dict[str, Any]:
    config = ConfigurationIMAP(**session["imap"])
    with connexion_imap(config) as client:
        client.select_folder(dossier, readonly=False)
        if lu:
            client.add_flags([uid], [b"\\Seen"])
        else:
            client.remove_flags([uid], [b"\\Seen"])
        return {"uid": uid, "lu": lu}


def supprimer_message_webmail(session: dict[str, Any], dossier: str, uid: int) -> dict[str, Any]:
    config = ConfigurationIMAP(**session["imap"])
    with connexion_imap(config) as client:
        client.select_folder(dossier, readonly=False)
        client.delete_messages([uid])
        client.expunge()
        return {"uid": uid, "supprime": True}


def envoyer_message_webmail(
    session: dict[str, Any],
    *,
    sujet: str,
    destinataires: list[str],
    copie: list[str] | None = None,
    copie_cachee: list[str] | None = None,
    corps_texte: str = "",
    corps_html: str | None = None,
    pieces_jointes: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    config_smtp = ConfigurationSMTP(**session["smtp"])
    config_imap = ConfigurationIMAP(**session["imap"])

    expediteur = session["courriel"]
    resultat = envoyer_courriel(
        sujet=sujet,
        destinataires=destinataires,
        copie=copie,
        copie_cachee=copie_cachee,
        corps_texte=corps_texte,
        corps_html=corps_html,
        expediteur=expediteur,
        reponse_a=[config_smtp.reponse_a] if config_smtp.reponse_a else None,
        configuration=config_smtp,
        pieces_jointes=pieces_jointes,
        origine="webmail",
        contexte_journal={"dossier": config_imap.dossier_envoyes, "compte": session["courriel"]},
    )

    message = EmailMessage()
    message["Subject"] = sujet
    message["From"] = expediteur
    message["To"] = ", ".join(destinataires)
    if copie:
        message["Cc"] = ", ".join(copie)
    message["Message-ID"] = resultat["message_id"]
    message.set_content(corps_texte or "")
    if corps_html:
        message.add_alternative(corps_html, subtype="html")
    for piece in pieces_jointes or []:
        type_mime = piece.get("type_mime") or mimetypes.guess_type(piece.get("nom", ""))[0] or "application/octet-stream"
        type_principal, sous_type = type_mime.split("/", 1)
        message.add_attachment(piece["contenu"], maintype=type_principal, subtype=sous_type, filename=piece.get("nom"))

    with connexion_imap(config_imap) as client:
        dossiers = _lister_dossiers_imap(client)
        for dossier in _candidats_dossier_envoyes(config_imap.dossier_envoyes, dossiers):
            try:
                client.append(dossier, message.as_bytes(), flags=[b"\\Seen"], msg_time=timezone.now())
                break
            except Exception:
                continue

    return resultat
