"""Services serveur pour les traitements métier paramétrables."""

from __future__ import annotations

import json
import os
import time
from decimal import Decimal
from typing import Any

import requests
from django.conf import settings
from django.utils import timezone

from .models import ConfigurationIAFonctionnelle, CorrectionIA, TraitementIA


class ErreurFournisseurMetier(Exception):
    """Erreur contrôlée lors d'un appel fournisseur."""


def _cle_fournisseur(fournisseur: str = "openai") -> str:
    if fournisseur != "openai":
        return ""
    return (
        getattr(settings, "OPENAI_API_KEY", "")
        or getattr(settings, "CLE_API_OPENAI", "")
        or os.environ.get("OPENAI_API_KEY", "")
        or os.environ.get("CLE_API_OPENAI", "")
    ).strip()


def fournisseur_disponible(fournisseur: str = "openai") -> bool:
    """Indique si un fournisseur est configuré côté serveur."""

    return bool(_cle_fournisseur(fournisseur))


def _entetes_openai() -> dict[str, str]:
    cle = _cle_fournisseur("openai")
    if not cle:
        raise ErreurFournisseurMetier("Aucune clé fournisseur n'est configurée côté serveur.")
    return {
        "Authorization": f"Bearer {cle}",
        "Content-Type": "application/json",
    }


def lister_modeles_disponibles(fournisseur: str = "openai") -> dict[str, Any]:
    """Liste les modèles disponibles sans exposer de secret."""

    if fournisseur != "openai":
        return {
            "fournisseur": fournisseur,
            "disponible": False,
            "modeles": [],
            "detail": "Ce fournisseur n'est pas encore branché côté serveur.",
        }
    if not fournisseur_disponible(fournisseur):
        raise ErreurFournisseurMetier("Aucune clé fournisseur n'est configurée côté serveur.")

    try:
        reponse = requests.get(
            "https://api.openai.com/v1/models",
            headers=_entetes_openai(),
            timeout=20,
        )
        reponse.raise_for_status()
    except requests.RequestException as exc:
        raise ErreurFournisseurMetier(f"Liste des modèles indisponible : {exc}") from exc

    donnees = reponse.json()
    modeles = sorted(
        [
            {
                "id": modele.get("id", ""),
                "proprietaire": modele.get("owned_by", ""),
                "date_creation": modele.get("created"),
            }
            for modele in donnees.get("data", [])
            if modele.get("id")
        ],
        key=lambda item: item["id"],
    )
    return {
        "fournisseur": fournisseur,
        "disponible": True,
        "modeles": modeles,
    }


def estimer_cout_traitement(configuration: ConfigurationIAFonctionnelle, entree: Any) -> Decimal:
    """Estimation prudente sans grille tarifaire codée en dur."""

    taille = len(json.dumps(entree, ensure_ascii=False, default=str))
    tokens_estimes = max(1, taille // 4)
    plafond = configuration.cout_max_par_traitement or Decimal("0")
    estimation = Decimal(tokens_estimes) * Decimal("0.000001")
    if plafond and estimation > plafond:
        return plafond
    return estimation.quantize(Decimal("0.0001"))


def _extraire_texte_reponse(donnees: dict[str, Any]) -> str:
    texte = donnees.get("output_text")
    if texte:
        return texte
    fragments: list[str] = []
    for element in donnees.get("output", []) or []:
        for contenu in element.get("content", []) or []:
            valeur = contenu.get("text") or contenu.get("output_text")
            if valeur:
                fragments.append(valeur)
    return "\n".join(fragments).strip()


def _normaliser_sortie(texte: str) -> Any:
    try:
        return json.loads(texte)
    except (json.JSONDecodeError, TypeError):
        return {"texte": texte}


def _appeler_openai(configuration: ConfigurationIAFonctionnelle, prompt_utilisateur: str) -> dict[str, Any]:
    if not configuration.modele:
        raise ErreurFournisseurMetier("Aucun modèle n'est renseigné sur cette configuration.")

    corps = {
        "model": configuration.modele,
        "instructions": configuration.prompt_systeme or "",
        "input": prompt_utilisateur,
        "temperature": float(configuration.temperature),
        "top_p": float(configuration.top_p),
        "max_output_tokens": int(configuration.max_tokens),
    }
    try:
        reponse = requests.post(
            "https://api.openai.com/v1/responses",
            headers=_entetes_openai(),
            json=corps,
            timeout=60,
        )
        reponse.raise_for_status()
    except requests.RequestException as exc:
        raise ErreurFournisseurMetier(f"Traitement fournisseur indisponible : {exc}") from exc
    return reponse.json()


def journaliser_traitement_ia(
    *,
    configuration: ConfigurationIAFonctionnelle | None,
    module: str,
    utilisateur=None,
    objet_type: str = "",
    objet_id: str = "",
    mode_execution: str = "",
    entree: dict[str, Any] | None = None,
    sortie: dict[str, Any] | None = None,
    prompt_systeme: str = "",
    prompt_utilisateur: str = "",
    modele_utilise: str = "",
    statut: str = "prepare",
    score_confiance: Decimal | float | str | None = None,
    cout_estime: Decimal | float | str | None = None,
    cout_reel: Decimal | float | str | None = None,
    duree_ms: int | None = None,
    tokens_entree: int | None = None,
    tokens_sortie: int | None = None,
    erreur: str = "",
) -> TraitementIA:
    """Crée une trace de traitement exploitable en administration."""

    return TraitementIA.objects.create(
        module=module,
        objet_type=objet_type,
        objet_id=str(objet_id or ""),
        configuration=configuration,
        statut=statut,
        mode_execution=mode_execution,
        modele_utilise=modele_utilise or (configuration.modele if configuration else ""),
        prompt_systeme=prompt_systeme or (configuration.prompt_systeme if configuration else ""),
        prompt_utilisateur=prompt_utilisateur,
        entree=entree or {},
        sortie=sortie or {},
        score_confiance=score_confiance,
        cout_estime=cout_estime,
        cout_reel=cout_reel,
        duree_ms=duree_ms,
        tokens_entree=tokens_entree,
        tokens_sortie=tokens_sortie,
        utilisateur=utilisateur,
        date_fin=timezone.now() if statut in {"termine", "erreur", "simulation"} else None,
        erreur=erreur,
    )


def executer_traitement_ia(
    configuration: ConfigurationIAFonctionnelle,
    entree: dict[str, Any],
    schema_sortie: dict[str, Any] | None = None,
    *,
    utilisateur=None,
    objet_type: str = "",
    objet_id: str = "",
    mode: str = "reel",
) -> TraitementIA:
    """Exécute ou simule un traitement et journalise le résultat."""

    prompt_utilisateur = json.dumps(
        {
            "consigne": configuration.prompt_controle or configuration.prompt_generation or configuration.prompt_systeme,
            "schema_sortie": schema_sortie or configuration.schema_sortie,
            "entree": entree,
        },
        ensure_ascii=False,
        default=str,
    )
    cout_estime = estimer_cout_traitement(configuration, entree)

    if mode == "simulation":
        if not configuration.mode_simulation_autorise:
            return journaliser_traitement_ia(
                configuration=configuration,
                module=configuration.module,
                utilisateur=utilisateur,
                objet_type=objet_type,
                objet_id=objet_id,
                mode_execution="simulation",
                entree=entree,
                sortie={"detail": "Le mode simulation n'est pas autorisé pour cette configuration."},
                prompt_utilisateur=prompt_utilisateur,
                statut="erreur",
                cout_estime=cout_estime,
                erreur="Simulation interdite.",
            )
        return journaliser_traitement_ia(
            configuration=configuration,
            module=configuration.module,
            utilisateur=utilisateur,
            objet_type=objet_type,
            objet_id=objet_id,
            mode_execution="simulation",
            entree=entree,
            sortie={
                "detail": "Test simulé : aucune clé API serveur n'est configurée.",
                "schema_sortie": schema_sortie or configuration.schema_sortie,
            },
            prompt_utilisateur=prompt_utilisateur,
            statut="simulation",
            score_confiance=configuration.seuil_confiance,
            cout_estime=cout_estime,
            cout_reel=Decimal("0"),
        )

    if not configuration.mode_reel_autorise:
        return journaliser_traitement_ia(
            configuration=configuration,
            module=configuration.module,
            utilisateur=utilisateur,
            objet_type=objet_type,
            objet_id=objet_id,
            mode_execution="reel",
            entree=entree,
            sortie={},
            prompt_utilisateur=prompt_utilisateur,
            statut="erreur",
            cout_estime=cout_estime,
            erreur="Le mode réel n'est pas autorisé pour cette configuration.",
        )

    debut = time.perf_counter()
    try:
        donnees = _appeler_openai(configuration, prompt_utilisateur)
        duree_ms = int((time.perf_counter() - debut) * 1000)
        texte = _extraire_texte_reponse(donnees)
        sortie = _normaliser_sortie(texte)
        usage = donnees.get("usage") or {}
        return journaliser_traitement_ia(
            configuration=configuration,
            module=configuration.module,
            utilisateur=utilisateur,
            objet_type=objet_type,
            objet_id=objet_id,
            mode_execution="reel",
            entree=entree,
            sortie=sortie if isinstance(sortie, dict) else {"resultat": sortie},
            prompt_utilisateur=prompt_utilisateur,
            statut="termine",
            score_confiance=configuration.seuil_confiance,
            cout_estime=cout_estime,
            cout_reel=cout_estime,
            duree_ms=duree_ms,
            tokens_entree=usage.get("input_tokens"),
            tokens_sortie=usage.get("output_tokens"),
        )
    except Exception as exc:
        return journaliser_traitement_ia(
            configuration=configuration,
            module=configuration.module,
            utilisateur=utilisateur,
            objet_type=objet_type,
            objet_id=objet_id,
            mode_execution="reel",
            entree=entree,
            sortie={},
            prompt_utilisateur=prompt_utilisateur,
            statut="erreur",
            cout_estime=cout_estime,
            duree_ms=int((time.perf_counter() - debut) * 1000),
            erreur=str(exc),
        )


def tester_configuration_ia(
    configuration: ConfigurationIAFonctionnelle,
    prompt_utilisateur: str,
    *,
    utilisateur=None,
    mode: str = "simulation",
    jeu_donnees: dict[str, Any] | None = None,
) -> TraitementIA:
    """Teste une configuration avec journalisation systématique."""

    if mode == "reel" and not fournisseur_disponible(configuration.fournisseur):
        mode = "simulation"
    return executer_traitement_ia(
        configuration,
        {
            "prompt_test": prompt_utilisateur,
            "jeu_donnees": jeu_donnees or {
                "designation": "Fourniture et pose d'un ouvrage type",
                "unite": "u",
                "quantite": 1,
            },
        },
        configuration.schema_sortie,
        utilisateur=utilisateur,
        objet_type="configuration_ia",
        objet_id=str(configuration.id),
        mode=mode,
    )


def enregistrer_corrections_ia(traitement: TraitementIA, corrections: list[dict[str, Any]]) -> list[CorrectionIA]:
    """Enregistre les corrections proposées par un traitement."""

    objets: list[CorrectionIA] = []
    for correction in corrections:
        objets.append(
            CorrectionIA.objects.create(
                traitement=traitement,
                objet_type=correction.get("objet_type", traitement.objet_type),
                objet_id=str(correction.get("objet_id", traitement.objet_id)),
                champ=correction.get("champ", ""),
                valeur_originale=correction.get("valeur_originale", ""),
                valeur_proposee=correction.get("valeur_proposee", ""),
                justification=correction.get("justification", ""),
            )
        )
    return objets
