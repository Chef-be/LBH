# Cohérence du wizard projet

## Objectif

Le wizard de création de projet doit qualifier un dossier métier, pas mélanger des notions de droit, de phase, de mission et de livrable.

La logique suivie est :

Type de client → sous-type → cadre juridique → mode de commande → rôle LBH → phase pertinente → mission confiée → livrables → méthodes → données techniques → modules actifs.

## Cadre juridique et mode de commande

Le cadre juridique indique le régime du marché :

- marché public ;
- marché privé ;
- mixte ;
- hors marché / conseil / assistance ponctuelle.

Le mode de commande indique la relation contractuelle :

- consultation directe ;
- appel d'offres ;
- accord-cadre ;
- marché subséquent ;
- co-traitance ;
- sous-traitance ;
- convention ;
- mission AMO ;
- audit.

L'ancien champ technique `contexte_contractuel` reste utilisé en base pour compatibilité, mais il représente désormais le mode de commande.

## Missions et phases

Les phases MOE ne sont pas des missions. Elles décrivent le moment d'intervention : ESQ, APS, APD, PRO, DCE, ACT, VISA, DET, OPC, AOR.

Les missions MOE sont par exemple :

- économie de conception ;
- rédaction pièces écrites ;
- estimation ;
- analyse offres ;
- suivi économique ;
- assistance réception.

## Cohérence MOA

Une maîtrise d'ouvrage peut demander une vérification d'enveloppe en programmation ou faisabilité.

La combinaison `MOA + vérification d'enveloppe + PRO` est incohérente si elle est présentée comme une production MOE. Elle doit être reformulée en `AMO — revue de l'estimation PRO`.

## Cohérence MOE

En PRO / DCE, les livrables attendus sont CCTP, DPGF, BPU / DQE et estimation.

En ACT, les livrables attendus sont rapport d'analyse des offres et tableau comparatif.

## Cohérence entreprise

Une entreprise travaille sur une consultation, une mise au point d'offre, une préparation, une exécution ou une clôture.

Les notions de déboursé sec, coefficient K, BPU, DPGF et DQE sont des composants de l'étude ou des livrables, pas des phases MOE.

## Co-traitance et sous-traitance

En co-traitance, le rôle de LBH et le périmètre confié doivent être clarifiés.

En sous-traitance, le donneur d'ordre, le format attendu et l'échéance doivent être renseignés.

## Méthodes d'estimation

Les méthodes sont filtrées selon le contexte :

- MOA faisabilité : ratios, retour d'expérience, macro-lots ;
- MOA revue PRO : revue estimation MOE, contrôle ratios, analyse écarts ;
- MOE APS/APD : estimation par lots, ratios ajustés, quantités sommaires ;
- MOE PRO/DCE : avant-métré, DPGF quantitative, estimation détaillée, BPU/DQE ;
- entreprise : étude de prix, sous-détail, déboursé sec, coefficient K, bibliothèque de prix.

## Données techniques

Les champs techniques sont dynamiques :

- MOA bâtiment : surfaces, enveloppe, niveau de prestation ;
- MOA infrastructure : linéaires, chaussées, réseaux, ouvrages ;
- MOE PRO/DCE : lots, plans, CCTP, DPGF, BPU/DQE ;
- entreprise : date limite, DCE reçu, lots, coefficient K, frais généraux, marge ;
- sous-traitance : format, délai, périmètre, niveau de détail.

## Fiche projet

La fiche projet affiche des couples `code` + `libelle` pour éviter les codes bruts côté interface.

Exemples :

- `maitrise_ouvrage` devient `Maîtrise d'ouvrage` ;
- `consultation_directe` devient `Consultation directe` ;
- `verifier_enveloppe` devient `Vérification d'enveloppe` ;
- `pro` devient `PRO / DCE` ;
- `infrastructure` devient `Infrastructure / VRD`.
