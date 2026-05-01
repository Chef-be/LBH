# Pilotage société par coefficient K

## Objectif

Le module Pilotage société calcule les prix de vente du bureau d'études à partir des coûts directs horaires et d'un coefficient K global. La source de vérité des calculs métier est le backend Django.

## Définitions

- Coût direct horaire : coût employeur annuel d'un profil divisé par ses heures productives annuelles.
- Coefficient K : multiplicateur appliqué au coût direct horaire pour obtenir un taux de vente HT.
- Taux horaire moyen pondéré : coût direct moyen pondéré des profils actifs multiplié par le coefficient K.
- Taux profil : coût direct horaire du profil multiplié par le coefficient K.
- Forfait jour : taux de vente horaire multiplié par les heures facturables par jour.
- Marge prévisionnelle : montant HT vendu moins coût direct estimé.
- Marge réelle : honoraires vendus moins coût réel des temps passés.

## Formules

```text
salaire brut estimé = (net + primes + avantages) / (1 - taux charges salariales)
charges patronales = salaire brut estimé × taux charges patronales
coût employeur mensuel = salaire brut estimé + charges patronales
coût employeur annuel = coût employeur mensuel × 12
coût direct horaire = coût employeur annuel / heures productives annuelles
```

```text
base frais = coût direct annuel + charges structure annuelles
frais généraux = base frais × taux frais généraux
frais commerciaux = base frais × taux frais commerciaux
risques = base frais × taux risque / aléas
impondérables = base frais × taux impondérables
coût complet annuel = coût direct annuel + charges structure + frais + risques + impondérables
CA cible annuel = coût complet annuel / (1 - taux marge cible)
coefficient K = CA cible annuel / coût direct annuel
```

```text
taux vente profil HT = coût direct horaire profil × coefficient K
forfait jour profil HT = taux vente profil HT × heures facturables par jour
coût direct moyen pondéré = somme(coût direct profil × poids) / somme(poids)
taux horaire moyen pondéré = coût direct moyen pondéré × coefficient K
```

Les divisions par zéro retournent une valeur nulle ou un coefficient K de repli à `1.0000`. Un taux de marge cible supérieur ou égal à 100 % déclenche une erreur contrôlée.

## Champs ajoutés

Paramètres société :

- `heures_facturables_jour`
- `taux_frais_generaux`
- `taux_frais_commerciaux`
- `taux_risque_alea`
- `taux_imponderables`
- `taux_marge_cible`
- `mode_arrondi_tarif`
- `pas_arrondi_tarif`
- `strategie_tarifaire`

Profils horaires :

- `cout_direct_horaire`
- `taux_vente_horaire_calcule`
- `forfait_jour_ht_calcule`
- `poids_ponderation`
- `inclure_taux_moyen`
- `coefficient_k_applique`

Lignes de devis :

- `mode_chiffrage`
- `nb_jours`
- `cout_direct_horaire_reference`
- `cout_direct_total_estime`
- `coefficient_k_applique`
- `marge_estimee_ht`
- `taux_marge_estime`
- `forfait_jour_ht_reference`
- `source_tarif`

## API

- `GET /api/societe/pilotage-economique/` retourne la synthèse économique annuelle.
- `POST /api/societe/recalculer-tarifs/` recalcule les simulations, les profils et la synthèse.
- Les serializers profils, simulations, missions, temps passés et devis exposent les nouveaux champs économiques.

## Procédure de recalcul

1. Mettre à jour les paramètres société et les charges fixes.
2. Vérifier les simulations salariales actives par profil.
3. Lancer `POST /api/societe/recalculer-tarifs/`.
4. Contrôler le coefficient K, le taux moyen pondéré et les forfaits jour.
5. Chiffrer les nouveaux devis avec le mode adapté : taux moyen BE, taux profil, forfait jour profil, forfait mission, frais ou sous-traitance.

## Limites et hypothèses

- Les anciens champs `dhmo`, `taux_horaire_ht`, `taux_horaire_ht_calcule` et `taux_marge_vente` sont conservés pour compatibilité.
- Le terme métier affiché pour `dhmo` est désormais coût direct horaire.
- Les anciennes lignes de devis restent valides : horaire devient `taux_profil`, forfait devient `forfait_mission`, frais et sous-traitance gardent leur nature.
- Les temps passés distinguent désormais coût direct horaire et taux de vente horaire. Si une ancienne donnée n'a pas de coût direct, l'ancien taux est repris comme repli.

## Vérification après déploiement

1. Appliquer les migrations Django.
2. Ouvrir Charges société et vérifier les paramètres, les catégories de charges et le bloc coefficient K.
3. Cliquer sur Recalculer les tarifs.
4. Ouvrir Taux horaires et vérifier coût direct, coefficient K, taux vente et forfait jour par profil.
5. Créer un devis avec les modes taux moyen BE, taux profil, forfait jour profil et forfait mission.
6. Vérifier le tableau de bord société : CA cible, marges, heures vendues, heures passées et seuil mensuel.
7. Exécuter les tests backend et le build frontend.
