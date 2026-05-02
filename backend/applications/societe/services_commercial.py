"""Services du cycle commercial : affaire, devis, facturation, paiement et livraison."""

from __future__ import annotations

import hashlib
import secrets
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from applications.projets.models import Projet
from applications.projets.serialiseurs import ProjetDetailSerialiseur

from .models import AffaireCommerciale, DevisHonoraires, Facture, Paiement, LivraisonLivrable


def generer_token_public() -> str:
    return secrets.token_urlsafe(48)


def hasher_token_public(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def generer_reference_affaire() -> str:
    annee = timezone.localdate().year
    prefixe = f"AF-{annee}-"
    dernier = (
        AffaireCommerciale.objects.filter(reference__startswith=prefixe)
        .order_by("-reference")
        .values_list("reference", flat=True)
        .first()
    )
    numero = int(dernier.rsplit("-", 1)[-1]) + 1 if dernier else 1
    return f"{prefixe}{numero:03d}"


def journaliser(objet, message: str, utilisateur=None, extra: dict | None = None) -> None:
    entree = {
        "date": timezone.now().isoformat(),
        "message": message,
        "utilisateur": str(getattr(utilisateur, "id", "") or ""),
        "extra": extra or {},
    }
    historique = list(getattr(objet, "historique", None) or getattr(objet, "historique_commercial", None) or [])
    historique.append(entree)
    if hasattr(objet, "historique"):
        objet.historique = historique
        objet.save(update_fields=["historique", "date_modification"])
    elif hasattr(objet, "historique_commercial"):
        objet.historique_commercial = historique
        objet.save(update_fields=["historique_commercial", "date_modification"])


def synchroniser_affaire_depuis_devis(devis: DevisHonoraires) -> None:
    affaire = devis.affaire
    if not affaire:
        return
    if devis.statut == "envoye":
        affaire.statut = "devis_envoye"
    elif devis.statut == "accepte":
        affaire.statut = "devis_accepte"
        affaire.date_acceptation = timezone.now()
    elif devis.statut == "refuse":
        affaire.statut = "affaire_perdue"
        affaire.date_refus = timezone.now()
        affaire.motif_refus = devis.motif_refus
    affaire.devis_principal = devis
    affaire.montant_estime_ht = devis.montant_ht
    affaire.montant_estime_ttc = devis.montant_ttc
    affaire.save(update_fields=[
        "statut", "date_acceptation", "date_refus", "motif_refus",
        "devis_principal", "montant_estime_ht", "montant_estime_ttc", "date_modification",
    ])


def preparer_lien_public_devis(devis: DevisHonoraires, *, expiration_jours: int = 30) -> str:
    token = generer_token_public()
    expiration = timezone.now() + timedelta(days=expiration_jours)
    devis.lien_public_token_hash = hasher_token_public(token)
    devis.lien_public_expiration = expiration
    devis.date_expiration_validation = expiration
    devis.statut = "envoye"
    devis.save(update_fields=[
        "lien_public_token_hash", "lien_public_expiration",
        "date_expiration_validation", "statut", "date_modification",
    ])
    synchroniser_affaire_depuis_devis(devis)
    return token


def retrouver_devis_par_token_public(token: str) -> DevisHonoraires:
    hash_token = hasher_token_public(token)
    return DevisHonoraires.objects.select_related("affaire", "projet").prefetch_related("lignes").get(
        lien_public_token_hash=hash_token,
    )


@transaction.atomic
def accepter_devis_public(devis: DevisHonoraires, donnees: dict, request=None) -> DevisHonoraires:
    if devis.statut in {"refuse", "annule", "remplace", "expire"}:
        raise ValueError("Ce devis ne peut plus être accepté.")
    if devis.lien_public_expiration and devis.lien_public_expiration < timezone.now():
        devis.statut = "expire"
        devis.save(update_fields=["statut", "date_modification"])
        raise ValueError("Le lien de validation du devis a expiré.")
    now = timezone.now()
    devis.statut = "accepte"
    devis.mode_validation = "client"
    devis.date_validation_client = now
    devis.date_acceptation = now.date()
    devis.nom_signataire = donnees.get("nom_signataire") or donnees.get("nom") or ""
    devis.email_signataire = donnees.get("email_signataire") or donnees.get("email") or devis.client_email
    devis.fonction_signataire = donnees.get("fonction_signataire") or ""
    devis.case_conditions_acceptees = bool(donnees.get("case_conditions_acceptees", True))
    devis.ip_acceptation = _ip_client(request)
    devis.user_agent_acceptation = request.META.get("HTTP_USER_AGENT", "")[:1000] if request else ""
    devis.signature_electronique_simple = {
        "date": now.isoformat(),
        "nom": devis.nom_signataire,
        "email": devis.email_signataire,
        "conditions_acceptees": devis.case_conditions_acceptees,
    }
    devis.save(update_fields=[
        "statut", "mode_validation", "date_validation_client", "date_acceptation",
        "nom_signataire", "email_signataire", "fonction_signataire",
        "case_conditions_acceptees", "ip_acceptation", "user_agent_acceptation",
        "signature_electronique_simple", "date_modification",
    ])
    synchroniser_affaire_depuis_devis(devis)
    return devis


@transaction.atomic
def refuser_devis_public(devis: DevisHonoraires, motif: str = "") -> DevisHonoraires:
    if devis.statut == "accepte":
        raise ValueError("Un devis accepté ne peut pas être refusé depuis ce lien.")
    now = timezone.now()
    devis.statut = "refuse"
    devis.date_refus = now.date()
    devis.motif_refus = motif or ""
    devis.save(update_fields=["statut", "date_refus", "motif_refus", "date_modification"])
    synchroniser_affaire_depuis_devis(devis)
    return devis


@transaction.atomic
def valider_manuellement_affaire(affaire: AffaireCommerciale, utilisateur, motif: str) -> AffaireCommerciale:
    if not getattr(utilisateur, "est_super_admin", False):
        raise PermissionError("Seul un super administrateur peut valider manuellement une affaire.")
    if not (motif or "").strip():
        raise ValueError("Le motif de validation manuelle est obligatoire.")
    affaire.validation_manuelle_admin = True
    affaire.validation_manuelle_par = utilisateur
    affaire.validation_manuelle_date = timezone.now()
    affaire.validation_manuelle_motif = motif
    affaire.statut = "affaire_validee"
    affaire.save(update_fields=[
        "validation_manuelle_admin", "validation_manuelle_par",
        "validation_manuelle_date", "validation_manuelle_motif",
        "statut", "date_modification",
    ])
    journaliser(affaire, "Affaire validée manuellement.", utilisateur, {"motif": motif})
    return affaire


@transaction.atomic
def creer_projet_depuis_affaire(affaire: AffaireCommerciale, utilisateur, *, autoriser_second_projet: bool = False) -> Projet:
    if affaire.projet_lie_id and not autoriser_second_projet:
        raise ValueError("Un projet est déjà rattaché à cette affaire.")
    if not affaire.projet_creable:
        raise ValueError("L'affaire doit être validée ou le devis accepté avant de créer un projet.")
    devis = affaire.devis_principal or affaire.devis.filter(statut="accepte").order_by("-date_acceptation").first()
    if devis and devis.statut == "refuse" and not affaire.validation_manuelle_admin:
        raise ValueError("Un devis refusé bloque la création du projet.")
    contexte = dict((devis.contexte_projet_saisie if devis else None) or affaire.donnees_metier or {})
    donnees = {
        "reference": Projet().generer_reference(),
        "intitule": affaire.intitule,
        "type_projet": "assistance" if affaire.type_client == "maitrise_ouvrage" else "etude",
        "statut": "en_cours",
        "organisation": str(utilisateur.organisation_id) if getattr(utilisateur, "organisation_id", None) else None,
        "description": affaire.description,
        "honoraires_prevus": devis.montant_ht if devis else affaire.montant_estime_ht,
        "qualification_wizard": {
            "source_affaire_id": str(affaire.id),
            "source_affaire_reference": affaire.reference,
            "source_devis_id": str(devis.id) if devis else "",
            "source_devis_reference": devis.reference if devis else "",
            "mode_facturation": affaire.mode_facturation,
            "mode_paiement_prevu": affaire.mode_paiement_prevu,
        },
        "contexte_projet_saisie": contexte,
    }
    serialiseur = ProjetDetailSerialiseur(data=donnees, context={"request": None})
    serialiseur.is_valid(raise_exception=True)
    projet = serialiseur.save(responsable=utilisateur, cree_par=utilisateur)
    affaire.projet_lie = projet
    affaire.statut = "projet_cree"
    affaire.save(update_fields=["projet_lie", "statut", "date_modification"])
    if devis:
        devis.projet = projet
        devis.save(update_fields=["projet", "date_modification"])
    journaliser(affaire, "Projet créé depuis l'affaire.", utilisateur, {"projet_id": str(projet.id)})
    return projet


def creer_lien_paiement(facture: Facture) -> dict:
    prestataire = getattr(settings, "PAIEMENT_PRESTATAIRE", "manuel")
    if prestataire == "manuel":
        facture.lien_paiement = ""
        facture.save(update_fields=["lien_paiement", "date_modification"])
        return {
            "mode": "manuel",
            "detail": "Aucun prestataire carte n'est configuré. Utilisez le virement ou configurez un PSP.",
            "lien_paiement": "",
        }
    reference = f"PAY-{facture.reference}-{secrets.token_hex(6)}"
    facture.lien_paiement = f"{getattr(settings, 'SITE_PUBLIC_URL', '').rstrip('/')}/paiement/{reference}"
    facture.save(update_fields=["lien_paiement", "date_modification"])
    Paiement.objects.create(
        facture=facture,
        affaire=facture.affaire,
        projet=facture.projet,
        date_paiement=timezone.localdate(),
        montant=facture.montant_restant,
        mode="carte",
        statut="initie",
        reference=reference,
        reference_transaction=reference,
        prestataire=prestataire,
        date_initiation=timezone.now(),
    )
    return {"mode": prestataire, "lien_paiement": facture.lien_paiement, "reference_transaction": reference}


def confirmer_paiement_manuel(facture: Facture, utilisateur, montant: Decimal | None = None, mode: str = "virement", reference: str = "") -> Paiement:
    paiement = Paiement.objects.create(
        facture=facture,
        affaire=facture.affaire,
        projet=facture.projet,
        date_paiement=timezone.localdate(),
        montant=montant or facture.montant_restant,
        mode=mode,
        statut="confirme",
        reference=reference,
        prestataire="manuel" if mode != "chorus_pro" else "chorus_pro",
        date_confirmation=timezone.now(),
        enregistre_par=utilisateur,
    )
    return paiement


def preparer_facture_chorus(facture: Facture) -> dict:
    return {
        "mode": getattr(settings, "CHORUS_MODE", "manuel"),
        "statut": facture.chorus_statut or "a_deposer",
        "reference": facture.reference,
        "montant_ttc": str(facture.montant_ttc),
        "client": facture.client_nom,
        "numero_depot": facture.chorus_numero_depot,
    }


def statut_chorus_manuel(facture: Facture, statut_chorus: str, numero_depot: str = "") -> Facture:
    facture.chorus_statut = statut_chorus
    if numero_depot:
        facture.chorus_numero_depot = numero_depot
    facture.chorus_derniere_synchro = timezone.now()
    if statut_chorus in {"deposee", "recue", "en_traitement", "mise_en_paiement"}:
        facture.statut = "deposee_chorus"
    if statut_chorus == "payee":
        facture.statut = "payee"
        facture.montant_paye = facture.montant_ttc
        facture.date_paiement = timezone.now()
    facture.save(update_fields=[
        "chorus_statut", "chorus_numero_depot", "chorus_derniere_synchro",
        "statut", "montant_paye", "date_paiement", "date_modification",
    ])
    return facture


def calculer_interets_moratoires(facture: Facture, *, taux_annuel: Decimal = Decimal("0.00"), indemnite: Decimal = Decimal("0.00")) -> dict:
    if facture.statut in {"payee", "annulee", "avoir"} or not facture.date_echeance:
        return {"statut": "interets_non_applicables", "montant": Decimal("0.00")}
    jours = max((timezone.localdate() - facture.date_echeance).days, 0)
    if jours <= 0 or taux_annuel <= 0:
        return {"statut": "interets_non_applicables", "montant": Decimal("0.00")}
    interets = (facture.montant_restant * taux_annuel * Decimal(jours) / Decimal("365")).quantize(Decimal("0.01"))
    return {"statut": "interets_a_appliquer", "montant": interets + indemnite, "jours_retard": jours}


def livraison_autorisee(facture: Facture, condition: str) -> bool:
    if condition == "gratuit":
        return True
    if condition == "paiement_recu":
        return facture.statut == "payee" or facture.montant_restant <= 0
    if condition == "facture_deposee_chorus":
        return facture.chorus_statut in {"deposee", "recue", "en_traitement", "mise_en_paiement", "payee"}
    return False


def preparer_livraison(facture: Facture, livrables: list[str], email: str, condition: str = "paiement_recu") -> list[LivraisonLivrable]:
    if not facture.projet_id:
        raise ValueError("La facture doit être liée à un projet pour préparer une livraison.")
    statut = "disponible" if livraison_autorisee(facture, condition) else "bloque"
    livraisons = []
    for code in livrables:
        token = generer_token_public()
        livraisons.append(LivraisonLivrable.objects.create(
            projet=facture.projet,
            affaire=facture.affaire,
            facture=facture,
            livrable_code=code,
            statut=statut,
            condition_livraison=condition,
            lien_token_hash=hasher_token_public(token),
            expiration=timezone.now() + timedelta(days=14),
            email_destinataire=email,
            historique=[{"date": timezone.now().isoformat(), "message": "Lien de livraison préparé."}],
        ))
    return livraisons


def _ip_client(request) -> str | None:
    if not request:
        return None
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",", 1)[0].strip()
    return request.META.get("REMOTE_ADDR")
