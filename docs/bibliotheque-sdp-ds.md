# Cohérence entre SDP et déboursé sec

## Définitions

Le sous-détail de prix, ou SDP, est la décomposition analytique réelle d'une ligne de prix. Il liste les ressources nécessaires à l'exécution : main-d'oeuvre, matières, matériel, consommables, sous-traitance, transport et frais divers.

Le déboursé sec, ou DS, est le coût direct de réalisation avant frais généraux, bénéfice et aléas. Dans la bibliothèque, le champ `debourse_sec_unitaire` est le DS agrégé affiché sur la ligne.

## Règle de priorité

Quand une ligne possède des `SousDetailPrix`, le DS de référence doit être le total du sous-détail analytique réel :

```text
Total SDP = somme(SousDetailPrix.montant_ht)
DS analytique = Total SDP
```

Le champ `debourse_sec_unitaire` reste une valeur de synthèse, mais il ne doit pas contredire silencieusement le SDP réel.

## DS estimé

Un DS peut aussi être estimé par moteur inverse depuis un prix de vente ou des ratios métier. Cette valeur est utile pour proposer une décomposition, mais elle n'est pas un sous-détail analytique réel.

La source du DS doit donc être explicite :

- `sdp_reel` : justifié par le sous-détail analytique réel ;
- `estimation_inverse` : calculé par moteur inverse ;
- `saisie_manuelle` : saisi ou conservé manuellement ;
- `import` : issu d'un import ;
- `inconnu` : source non déterminée.

## Alerte d'écart SDP/DS

L'application compare le Total SDP au DS agrégé. Si l'écart dépasse 0,01 €, elle affiche une alerte de cohérence.

Exemple :

```text
Total SDP = 2,52 €
DS agrégé = 4,80 €
Écart = 2,28 €
```

Interprétation :

La ligne annonce un DS de 4,80 €, mais seuls 2,52 € sont justifiés par le sous-détail analytique. Il faut soit recalculer le DS à 2,52 €, soit compléter le SDP pour justifier les 2,28 € manquants.

## Actions possibles

### Recalculer le DS depuis le SDP

Cette action applique :

```text
debourse_sec_unitaire = Total SDP
```

Elle met aussi à jour les composantes agrégées :

- temps de main-d'oeuvre ;
- taux horaire moyen pondéré ;
- coût matières ;
- coût matériel ;
- consommables ;
- sous-traitance ;
- transport ;
- frais divers.

Le prix de vente unitaire n'est pas modifié.

### Compléter le SDP

Si le DS agrégé est supérieur au Total SDP, l'application peut proposer une ligne de complément :

```text
Type : frais divers
Désignation : Complément de déboursé à qualifier
Quantité : 1
Montant : écart à justifier
```

Cette ligne n'est créée qu'après confirmation utilisateur. Elle doit ensuite être requalifiée pour devenir une justification analytique fiable.

### Générer une proposition estimée

Si aucun sous-détail n'existe, l'application peut générer une proposition de décomposition estimée depuis le DS ou le prix de vente. Cette proposition doit rester identifiée comme estimation et ne pas être affichée comme un SDP réel validé.

## Procédure de correction

1. Ouvrir l'audit SDP / déboursé sec.
2. Comparer le Total SDP, le DS agrégé et l'écart.
3. Si le SDP réel est complet, recalculer le DS depuis le SDP.
4. Si le DS agrégé est correct mais incomplet côté SDP, proposer puis confirmer un complément SDP.
5. Requalifier les lignes de complément avant validation métier.
