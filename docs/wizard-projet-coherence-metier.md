# Wizard projet et cohérence métier

## Principe

Le wizard de création projet n'est pas une succession de listes indépendantes. Chaque réponse filtre les options suivantes.

La logique cible est :

Type client → rôle LBH → cadre juridique → mode de commande → mission → phase → pièces sources → modules → livrables → contrôles → actions.

## Notions séparées

### Cadre juridique

- marché public ;
- marché privé ;
- mixte ;
- hors marché.

### Mode de commande ou relation contractuelle

- consultation directe ;
- appel d'offres ;
- accord-cadre ;
- marché subséquent ;
- co-traitance ;
- sous-traitance ;
- mission AMO ;
- audit.

Le cadre juridique ne doit pas être dupliqué dans le mode de commande. La fiche affiche une seule fois chaque notion.

## Phase, mission et livrable

Une phase n'est pas une mission.

Exemple MOE :

- phase : PRO / DCE ;
- mission : économie de conception ;
- livrables : CCTP, DPGF, BPU / DQE, estimation.

Exemple entreprise :

- phase : consultation ;
- mission : réponse à appel d'offres ;
- livrables : analyse DCE, étude de prix, mémoire technique.

## Règle MOA PRO / DCE

Une maîtrise d'ouvrage ne doit pas être qualifiée comme vérification d'enveloppe en phase de production PRO / DCE.

Si le payload contient :

- type client : maîtrise d'ouvrage ;
- mission : vérification d'enveloppe ;
- phase : PRO / DCE ;

alors le dossier est incohérent.

Suggestions proposées :

- requalifier en AMO — revue de l'estimation PRO/DCE ;
- remplacer la phase par Faisabilité ou Programmation ;
- requalifier en Maîtrise d'œuvre / Économie de conception si LBH produit le PRO/DCE.

## Maîtrise d'œuvre

Les phases ESQ, APS, APD, PRO, DCE, ACT, VISA, DET, OPC et AOR restent des phases.

Les missions MOE sont :

- économie de conception ;
- rédaction pièces écrites ;
- estimation ;
- analyse offres ;
- suivi économique ;
- assistance réception.

## Entreprise

Les missions entreprise sont :

- réponse à appel d'offres ;
- chiffrage direct ;
- devis direct ;
- étude de prix ;
- mémoire technique ;
- planning d'exécution.

Les déboursés secs, sous-détails de prix, coefficient K, BPU, DPGF et DQE sont des composantes ou livrables de l'étude de prix.

## Économie amont

Contextes :

- MOA ;
- AMO ;
- faisabilité ;
- programmation ;
- vérification d'enveloppe.

Méthodes :

- ratio au m² ;
- ratio fonctionnel ;
- retour d'expérience ;
- macro-lots ;
- comparaison enveloppe / programme.

Le module Métrés n'est pas obligatoire.

## Économie détaillée

Contextes :

- MOE PRO / DCE ;
- DPGF quantitative ;
- BPU / DQE ;
- étude de prix entreprise ;
- réponse à appel d'offres.

Le module Métrés est obligatoire, car un quantitatif est nécessaire.

## Données techniques dynamiques

Les champs techniques dépendent du contexte :

- MOA bâtiment : surfaces, enveloppe, ratio ;
- MOA infrastructure : linéaires, chaussée, réseaux, contraintes ;
- MOE PRO / DCE : lots, plans, CCTP, DPGF, BPU / DQE ;
- Entreprise : DCE reçu, lots, coefficient K, marge, variantes ;
- Sous-traitance : format attendu, délai, périmètre confié ;
- AMO : question client, documents à contrôler, niveau d'analyse.

## Règles d'interface

- Le contexte complet s'ouvre en modal.
- Le détail d'un module s'ouvre en drawer.
- Les corrections métier s'affichent dans une modal de contrôle.
- Aucune action ne doit utiliser `window.confirm` ou `window.prompt`.
- Les erreurs doivent être locales et réessayables.
