# Intégration Chorus Pro

## Positionnement

Chorus Pro est traité comme un canal de dépôt et de suivi des factures publiques. Ce n'est pas un paiement instantané.

Le système prévoit trois modes :

- `desactive` : aucun flux Chorus Pro.
- `manuel` : dépôt sur le portail Chorus Pro et suivi manuel du numéro de dépôt et du statut.
- `api` : intégration technique future via raccordement Chorus Pro.

## Vérification officielle

La documentation officielle Chorus Pro indique que les modes d'accès sont le portail, le mode service API et l'EDI. Elle précise aussi que le mode portail reste disponible, et que les raccordements API/EDI nécessitent un environnement et des démarches de connexion.

Source officielle : https://communaute.chorus-pro.gouv.fr/documentation/choisir-mode-dacces-a-chorus-pro

## Mode manuel

Le mode manuel est le mode opérationnel de départ :

1. Préparer la facture dans LBH.
2. Déposer la facture sur le portail Chorus Pro.
3. Renseigner le numéro de dépôt Chorus dans LBH.
4. Suivre le statut manuellement.
5. Marquer le paiement reçu après règlement.

Statuts internes :

- `a_deposer` ;
- `deposee` ;
- `recue` ;
- `rejetee` ;
- `suspendue` ;
- `en_traitement` ;
- `mise_en_paiement` ;
- `payee` ;
- `annulee`.

## Mode API futur

Le service `services_chorus_pro.py` isole les fonctions nécessaires :

- vérifier si Chorus Pro est actif ;
- préparer la facture ;
- déposer ;
- synchroniser le statut ;
- traiter un retour ;
- journaliser les échanges.

Les paramètres prévus sont :

- `CHORUS_MODE` ;
- `CHORUS_ENV` ;
- `CHORUS_CLIENT_ID` ;
- `CHORUS_CLIENT_SECRET` ;
- `CHORUS_STRUCTURE_ID` ;
- `CHORUS_API_BASE_URL` ;
- `CHORUS_OAUTH_URL`.

Avant activation API, les identifiants, certificats, environnements et habilitations doivent être validés dans l'espace de raccordement Chorus Pro.
