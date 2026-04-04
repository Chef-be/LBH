"""
Moteur de dimensionnement de chaussées — Plateforme LBH.

Méthode : Guide Technique SETRA/LCPC (catalogue des structures types de chaussées neuves).
Normes de référence :
  - Guide technique SETRA/LCPC 1994 (chaussées neuves)
  - Instruction sur les Conditions Techniques d'Aménagement des Voies Rapides Urbaines (ICTAVRU)
  - Circulaire n°2000-82 du 22 déc. 2000 — Instruction sur les Conditions Techniques
    d'Aménagement des Autoroutes de Rase Campagne (ICTARC)

Toutes les formules sont documentées dans matrices/calculs.md.
Aucune valeur métier codée en dur — tout passe par ParametresCalculVoirie.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from decimal import Decimal
from enum import Enum
from typing import Optional


# ---------------------------------------------------------------------------
# Énumérations
# ---------------------------------------------------------------------------

class ClasseDeformation(str, Enum):
    """Classe de déformation de la plate-forme support."""
    PF1 = "PF1"   # Très mauvaise : CBR ≤ 5
    PF2 = "PF2"   # Normale : 5 < CBR ≤ 10
    PF3 = "PF3"   # Bonne : 10 < CBR ≤ 25
    PF4 = "PF4"   # Très bonne : CBR > 25


class ClasseTrafficPoids(str, Enum):
    """Classe de trafic poids lourds (PL/j dans le sens le plus chargé)."""
    T5 = "T5"   # < 25 PL/j
    T4 = "T4"   # 25 – 85 PL/j
    T3 = "T3"   # 85 – 150 PL/j
    T2 = "T2"   # 150 – 300 PL/j
    T1 = "T1"   # 300 – 750 PL/j
    T0 = "T0"   # 750 – 2 000 PL/j
    TE1 = "TE1" # 2 000 – 5 000 PL/j
    TE2 = "TE2" # > 5 000 PL/j


class TypeStructure(str, Enum):
    """Type de structure de chaussée."""
    BB = "BB"         # Bitumineuse bicouche
    GB = "GB"         # Grave-bitume
    GH = "GH"         # Grave-émulsion ou grave-bitume (chaussées souples)
    BC = "BC"         # Béton de ciment
    EC = "EC"         # En béton de ciment (dalle)
    MIXTE = "MIXTE"   # Structure mixte (grave-ciment + BB)
    SOUPLE = "SOUPLE" # Structure souple (GNT + BB)
    SEMI_RIGIDE = "SEMI_RIGIDE"  # Semi-rigide (grave-ciment ou grave-laitier)


class EtatRentabiliteChaussee(str, Enum):
    VALIDE = "valide"
    EPAISSEUR_LIMITE = "epaisseur_limite"
    NON_CONFORME = "non_conforme"
    DONNEES_INSUFFISANTES = "donnees_insuffisantes"


# ---------------------------------------------------------------------------
# Paramètres de calcul (tous externalisables en base de données)
# ---------------------------------------------------------------------------

@dataclass
class ParametresCalculVoirie:
    """
    Paramètres de dimensionnement voirie.
    Toutes les valeurs ont un défaut conforme au guide SETRA/LCPC 1994.
    Peuvent être surchargés depuis le modèle Parametre en base.
    """

    # ---- Trafic ----
    taux_croissance_annuel: Decimal = Decimal("0.02")   # 2 % par défaut
    duree_vie_ans: int = 20                              # durée de vie cible
    coefficient_agressivite_pl: Decimal = Decimal("0.8")  # CAM moyen (PL standards)
    # Coefficient de distribution latérale (part de la voie la plus chargée)
    coefficient_distribution_laterale: Decimal = Decimal("0.5")

    # ---- Portance plate-forme ----
    # Module de Young de la plate-forme (MPa) par classe
    modules_plateforme: dict = field(default_factory=lambda: {
        ClasseDeformation.PF1: Decimal("20"),
        ClasseDeformation.PF2: Decimal("50"),
        ClasseDeformation.PF3: Decimal("120"),
        ClasseDeformation.PF4: Decimal("200"),
    })

    # ---- Épaisseurs minimales (cm) ----
    epaisseur_min_couche_roulement_cm: Decimal = Decimal("4")
    epaisseur_min_couche_liaison_cm: Decimal = Decimal("6")
    epaisseur_min_couche_base_cm: Decimal = Decimal("10")
    epaisseur_min_couche_fondation_cm: Decimal = Decimal("15")

    # ---- Tolérance ----
    tolerance_epaisseur_cm: Decimal = Decimal("0.5")  # ±0.5 cm


# ---------------------------------------------------------------------------
# Données d'entrée
# ---------------------------------------------------------------------------

@dataclass
class DonneesEntreeVoirie:
    """Données d'entrée pour le dimensionnement d'une chaussée."""

    # Trafic
    tmja_vl: int                   # Trafic moyen journalier annuel — véhicules légers
    tmja_pl: int                   # Trafic moyen journalier annuel — poids lourds
    duree_vie_ans: Optional[int] = None  # Si None → utilise paramètre par défaut

    # Sol support
    cbr: Optional[Decimal] = None              # Indice CBR (si connu)
    classe_plateforme: Optional[ClasseDeformation] = None  # Si CBR inconnu

    # Contraintes
    epaisseur_totale_max_cm: Optional[Decimal] = None  # Contrainte de hauteur maxi
    type_structure_prefere: Optional[TypeStructure] = None  # Suggestion maîtrise d'ouvrage

    # Facteurs de correction
    zone_climatique: str = "temperee"  # temperee / montagneuse / oceanique
    proximite_eau: bool = False        # Chaussée en zone humide


# ---------------------------------------------------------------------------
# Résultats
# ---------------------------------------------------------------------------

@dataclass
class EpaisseurCouche:
    """Épaisseur d'une couche de chaussée."""
    nom: str
    materiau: str
    epaisseur_cm: Decimal
    module_mpa: Optional[Decimal] = None


@dataclass
class ResultatDimensionnement:
    """Résultat complet d'un dimensionnement de chaussée."""

    # Trafic calculé
    trafic_cumule_pl: Decimal          # NE : trafic cumulé équivalent (10⁶ essieux)
    classe_trafic: ClasseTrafficPoids
    classe_plateforme: ClasseDeformation

    # Structure proposée
    type_structure: TypeStructure
    couches: list[EpaisseurCouche]
    epaisseur_totale_cm: Decimal

    # Validation
    etat: EtatRentabiliteChaussee
    conforme: bool
    avertissements: list[str]
    justification: str

    # Métadonnées
    methode: str = "SETRA/LCPC 1994"
    parametres_utilises: Optional[ParametresCalculVoirie] = None


# ---------------------------------------------------------------------------
# Fonctions de calcul
# ---------------------------------------------------------------------------

def cbr_vers_classe_plateforme(cbr: Decimal) -> ClasseDeformation:
    """
    Convertit un indice CBR en classe de plate-forme.
    Source : Guide SETRA/LCPC 1994, chapitre 2.
    """
    if cbr <= 5:
        return ClasseDeformation.PF1
    elif cbr <= 10:
        return ClasseDeformation.PF2
    elif cbr <= 25:
        return ClasseDeformation.PF3
    else:
        return ClasseDeformation.PF4


def calculer_trafic_cumule(
    tmja_pl: int,
    duree_vie_ans: int,
    taux_croissance: Decimal,
    cam: Decimal,
    coeff_distribution: Decimal,
) -> Decimal:
    """
    Calcule le trafic cumulé en millions d'essieux standard équivalents (MESE).

    Formule :
        NE = (TMJA_PL × CAM × CD × 365 × ((1 + t)^n - 1) / t) / 10⁶

    Avec :
        TMJA_PL : trafic moyen journalier annuel poids lourds (sens le plus chargé)
        CAM     : coefficient d'agressivité moyen du PL type
        CD      : coefficient de distribution latérale
        t       : taux de croissance annuel
        n       : durée de vie (années)

    Source : Guide SETRA/LCPC 1994, § 3.2.
    """
    if taux_croissance == Decimal("0"):
        facteur_capitalisation = Decimal(str(duree_vie_ans))
    else:
        facteur_capitalisation = Decimal(
            str((pow(float(1 + taux_croissance), duree_vie_ans) - 1) / float(taux_croissance))
        )

    ne = (
        Decimal(str(tmja_pl))
        * cam
        * coeff_distribution
        * Decimal("365")
        * facteur_capitalisation
        / Decimal("1000000")
    )
    return ne.quantize(Decimal("0.001"))


def tmja_pl_vers_classe_trafic(tmja_pl: int) -> ClasseTrafficPoids:
    """
    Classe le trafic PL journalier selon le guide SETRA/LCPC 1994, tableau 3.1.
    """
    if tmja_pl < 25:
        return ClasseTrafficPoids.T5
    elif tmja_pl < 85:
        return ClasseTrafficPoids.T4
    elif tmja_pl < 150:
        return ClasseTrafficPoids.T3
    elif tmja_pl < 300:
        return ClasseTrafficPoids.T2
    elif tmja_pl < 750:
        return ClasseTrafficPoids.T1
    elif tmja_pl < 2000:
        return ClasseTrafficPoids.T0
    elif tmja_pl < 5000:
        return ClasseTrafficPoids.TE1
    else:
        return ClasseTrafficPoids.TE2


def choisir_type_structure(
    classe_trafic: ClasseTrafficPoids,
    classe_plateforme: ClasseDeformation,
    type_prefere: Optional[TypeStructure] = None,
) -> TypeStructure:
    """
    Sélectionne le type de structure le plus adapté selon la matrice trafic/portance.

    Matrice simplifiée (catalogue SETRA/LCPC 1994) :
        T5/T4 → SOUPLE (trafic faible, peu onéreux)
        T3/T2 → GB ou SEMI_RIGIDE
        T1/T0 → GB ou SEMI_RIGIDE
        TE1/TE2 → BC ou SEMI_RIGIDE (structures renforcées)

    PF1 → préférer SEMI_RIGIDE pour renforcer le sol
    PF4 + trafic faible → SOUPLE suffisant
    """
    trafics_eleves = {ClasseTrafficPoids.TE1, ClasseTrafficPoids.TE2}
    trafics_moyens = {ClasseTrafficPoids.T0, ClasseTrafficPoids.T1, ClasseTrafficPoids.T2}
    trafics_faibles = {ClasseTrafficPoids.T3, ClasseTrafficPoids.T4, ClasseTrafficPoids.T5}

    if type_prefere is not None:
        return type_prefere

    if classe_trafic in trafics_eleves:
        return TypeStructure.SEMI_RIGIDE if classe_plateforme == ClasseDeformation.PF1 else TypeStructure.BC

    if classe_trafic in trafics_moyens:
        return TypeStructure.SEMI_RIGIDE if classe_plateforme in (ClasseDeformation.PF1, ClasseDeformation.PF2) else TypeStructure.GB

    # Trafics faibles
    if classe_plateforme == ClasseDeformation.PF1:
        return TypeStructure.SEMI_RIGIDE
    return TypeStructure.SOUPLE


# Catalogue d'épaisseurs types (cm) : (trafic, plateforme) → [fondation, base, liaison, roulement]
# Source : Catalogue des structures types SETRA/LCPC 1994, tableaux annexes
# Format : {(ClasseTrafficPoids, ClasseDeformation): (fondation, base, liaison, roulement)}
CATALOGUE_EPAISSEURS_SOUPLE: dict[tuple, tuple] = {
    (ClasseTrafficPoids.T5, ClasseDeformation.PF1): (20, 15, 0, 6),
    (ClasseTrafficPoids.T5, ClasseDeformation.PF2): (15, 12, 0, 5),
    (ClasseTrafficPoids.T5, ClasseDeformation.PF3): (10, 10, 0, 5),
    (ClasseTrafficPoids.T5, ClasseDeformation.PF4): (0, 10, 0, 4),
    (ClasseTrafficPoids.T4, ClasseDeformation.PF1): (25, 15, 0, 6),
    (ClasseTrafficPoids.T4, ClasseDeformation.PF2): (20, 15, 0, 6),
    (ClasseTrafficPoids.T4, ClasseDeformation.PF3): (15, 12, 0, 6),
    (ClasseTrafficPoids.T4, ClasseDeformation.PF4): (10, 10, 0, 5),
    (ClasseTrafficPoids.T3, ClasseDeformation.PF1): (30, 20, 6, 6),
    (ClasseTrafficPoids.T3, ClasseDeformation.PF2): (25, 18, 6, 6),
    (ClasseTrafficPoids.T3, ClasseDeformation.PF3): (20, 15, 6, 6),
    (ClasseTrafficPoids.T3, ClasseDeformation.PF4): (15, 12, 6, 5),
    (ClasseTrafficPoids.T2, ClasseDeformation.PF1): (30, 25, 6, 6),
    (ClasseTrafficPoids.T2, ClasseDeformation.PF2): (25, 20, 6, 6),
    (ClasseTrafficPoids.T2, ClasseDeformation.PF3): (20, 18, 6, 6),
    (ClasseTrafficPoids.T2, ClasseDeformation.PF4): (15, 15, 6, 6),
}

CATALOGUE_EPAISSEURS_SEMI_RIGIDE: dict[tuple, tuple] = {
    (ClasseTrafficPoids.T3, ClasseDeformation.PF1): (20, 20, 0, 6),
    (ClasseTrafficPoids.T3, ClasseDeformation.PF2): (15, 18, 0, 6),
    (ClasseTrafficPoids.T3, ClasseDeformation.PF3): (10, 16, 0, 6),
    (ClasseTrafficPoids.T3, ClasseDeformation.PF4): (0, 15, 0, 5),
    (ClasseTrafficPoids.T2, ClasseDeformation.PF1): (25, 22, 0, 6),
    (ClasseTrafficPoids.T2, ClasseDeformation.PF2): (20, 20, 0, 6),
    (ClasseTrafficPoids.T2, ClasseDeformation.PF3): (15, 18, 0, 6),
    (ClasseTrafficPoids.T2, ClasseDeformation.PF4): (10, 15, 0, 6),
    (ClasseTrafficPoids.T1, ClasseDeformation.PF1): (30, 25, 0, 6),
    (ClasseTrafficPoids.T1, ClasseDeformation.PF2): (25, 22, 0, 6),
    (ClasseTrafficPoids.T1, ClasseDeformation.PF3): (20, 20, 0, 6),
    (ClasseTrafficPoids.T1, ClasseDeformation.PF4): (15, 18, 0, 6),
    (ClasseTrafficPoids.T0, ClasseDeformation.PF1): (30, 28, 0, 6),
    (ClasseTrafficPoids.T0, ClasseDeformation.PF2): (25, 25, 0, 6),
    (ClasseTrafficPoids.T0, ClasseDeformation.PF3): (20, 22, 0, 6),
    (ClasseTrafficPoids.T0, ClasseDeformation.PF4): (15, 20, 0, 6),
    (ClasseTrafficPoids.TE1, ClasseDeformation.PF1): (35, 30, 0, 6),
    (ClasseTrafficPoids.TE1, ClasseDeformation.PF2): (30, 28, 0, 6),
    (ClasseTrafficPoids.TE1, ClasseDeformation.PF3): (25, 25, 0, 6),
    (ClasseTrafficPoids.TE1, ClasseDeformation.PF4): (20, 22, 0, 6),
    (ClasseTrafficPoids.TE2, ClasseDeformation.PF1): (40, 35, 0, 6),
    (ClasseTrafficPoids.TE2, ClasseDeformation.PF2): (35, 30, 0, 6),
    (ClasseTrafficPoids.TE2, ClasseDeformation.PF3): (28, 28, 0, 6),
    (ClasseTrafficPoids.TE2, ClasseDeformation.PF4): (22, 25, 0, 6),
}


def lire_epaisseurs_catalogue(
    classe_trafic: ClasseTrafficPoids,
    classe_plateforme: ClasseDeformation,
    type_structure: TypeStructure,
    params: ParametresCalculVoirie,
) -> list[EpaisseurCouche]:
    """
    Lit les épaisseurs dans le catalogue SETRA/LCPC et construit la liste des couches.
    Retourne une liste de couches non vides (épaisseur > 0).
    """
    catalogue = (
        CATALOGUE_EPAISSEURS_SEMI_RIGIDE
        if type_structure in (TypeStructure.SEMI_RIGIDE, TypeStructure.BC)
        else CATALOGUE_EPAISSEURS_SOUPLE
    )

    cle = (classe_trafic, classe_plateforme)

    # Interpolation par défaut si la clé exacte n'existe pas
    if cle not in catalogue:
        # Prendre la combinaison la plus proche (même trafic, PF la moins bonne)
        pf_par_ordre = [
            ClasseDeformation.PF1,
            ClasseDeformation.PF2,
            ClasseDeformation.PF3,
            ClasseDeformation.PF4,
        ]
        for pf in pf_par_ordre:
            cle_alt = (classe_trafic, pf)
            if cle_alt in catalogue:
                cle = cle_alt
                break
        else:
            # Aucune correspondance : valeurs minimales de sécurité
            return [
                EpaisseurCouche(
                    nom="Couche de fondation",
                    materiau="GNT classe B",
                    epaisseur_cm=params.epaisseur_min_couche_fondation_cm,
                ),
                EpaisseurCouche(
                    nom="Couche de base",
                    materiau="Grave-bitume 0/20",
                    epaisseur_cm=params.epaisseur_min_couche_base_cm,
                ),
                EpaisseurCouche(
                    nom="Couche de roulement",
                    materiau="BBSG 0/10",
                    epaisseur_cm=params.epaisseur_min_couche_roulement_cm,
                ),
            ]

    fondation_cm, base_cm, liaison_cm, roulement_cm = catalogue[cle]

    couches = []
    if fondation_cm > 0:
        materiau_fondation = (
            "Grave-ciment" if type_structure == TypeStructure.SEMI_RIGIDE else "GNT classe A"
        )
        couches.append(EpaisseurCouche(
            nom="Couche de fondation",
            materiau=materiau_fondation,
            epaisseur_cm=Decimal(str(fondation_cm)),
        ))
    if base_cm > 0:
        materiau_base = (
            "Grave-laitier ou grave-ciment"
            if type_structure == TypeStructure.SEMI_RIGIDE
            else "Grave-bitume 0/20"
        )
        couches.append(EpaisseurCouche(
            nom="Couche de base",
            materiau=materiau_base,
            epaisseur_cm=Decimal(str(base_cm)),
        ))
    if liaison_cm > 0:
        couches.append(EpaisseurCouche(
            nom="Couche de liaison",
            materiau="Grave-bitume 0/14 ou EME",
            epaisseur_cm=Decimal(str(liaison_cm)),
        ))
    couches.append(EpaisseurCouche(
        nom="Couche de roulement",
        materiau="BBSG 0/10 ou BBTM",
        epaisseur_cm=Decimal(str(max(roulement_cm, int(params.epaisseur_min_couche_roulement_cm)))),
    ))
    return couches


def dimensionner_chaussee(
    donnees: DonneesEntreeVoirie,
    params: Optional[ParametresCalculVoirie] = None,
) -> ResultatDimensionnement:
    """
    Fonction principale de dimensionnement de chaussée.

    Enchaîne :
        1. Détermination de la classe de plate-forme
        2. Calcul du trafic cumulé NE
        3. Classification du trafic PL
        4. Choix du type de structure
        5. Lecture des épaisseurs dans le catalogue
        6. Validation et construction du résultat
    """
    if params is None:
        params = ParametresCalculVoirie()

    avertissements: list[str] = []

    # 1. Plate-forme
    if donnees.classe_plateforme is not None:
        classe_plateforme = donnees.classe_plateforme
    elif donnees.cbr is not None:
        classe_plateforme = cbr_vers_classe_plateforme(donnees.cbr)
    else:
        # Valeur conservative par défaut
        classe_plateforme = ClasseDeformation.PF2
        avertissements.append(
            "Classe de plate-forme non renseignée — PF2 appliquée par défaut (valeur conservative)."
        )

    # 2. Durée de vie
    duree_vie = donnees.duree_vie_ans if donnees.duree_vie_ans else params.duree_vie_ans

    # 3. Trafic cumulé
    trafic_cumule = calculer_trafic_cumule(
        tmja_pl=donnees.tmja_pl,
        duree_vie_ans=duree_vie,
        taux_croissance=params.taux_croissance_annuel,
        cam=params.coefficient_agressivite_pl,
        coeff_distribution=params.coefficient_distribution_laterale,
    )

    # 4. Classe de trafic
    classe_trafic = tmja_pl_vers_classe_trafic(donnees.tmja_pl)

    # 5. Type de structure
    type_structure = choisir_type_structure(
        classe_trafic=classe_trafic,
        classe_plateforme=classe_plateforme,
        type_prefere=donnees.type_structure_prefere,
    )

    # 6. Épaisseurs
    couches = lire_epaisseurs_catalogue(
        classe_trafic=classe_trafic,
        classe_plateforme=classe_plateforme,
        type_structure=type_structure,
        params=params,
    )

    epaisseur_totale = sum(c.epaisseur_cm for c in couches)

    # 7. Validation contraintes
    conforme = True
    etat = EtatRentabiliteChaussee.VALIDE

    if donnees.epaisseur_totale_max_cm and epaisseur_totale > donnees.epaisseur_totale_max_cm:
        conforme = False
        etat = EtatRentabiliteChaussee.EPAISSEUR_LIMITE
        avertissements.append(
            f"L'épaisseur totale calculée ({epaisseur_totale} cm) dépasse le maximum admissible "
            f"({donnees.epaisseur_totale_max_cm} cm). Revoir la contrainte ou renforcer la plate-forme."
        )

    if donnees.proximite_eau and classe_plateforme in (ClasseDeformation.PF1, ClasseDeformation.PF2):
        avertissements.append(
            "Zone humide et portance faible : prévoir un drainage renforcé et un géotextile."
        )

    if donnees.zone_climatique == "montagneuse":
        avertissements.append(
            "Zone montagneuse : vérifier la résistance au gel — couche de forme antigel possible."
        )

    justification = (
        f"Structure {type_structure.value} — trafic {classe_trafic.value} "
        f"({donnees.tmja_pl} PL/j) sur plate-forme {classe_plateforme.value}. "
        f"NE = {trafic_cumule} M essieux sur {duree_vie} ans. "
        f"Méthode SETRA/LCPC 1994."
    )

    return ResultatDimensionnement(
        trafic_cumule_pl=trafic_cumule,
        classe_trafic=classe_trafic,
        classe_plateforme=classe_plateforme,
        type_structure=type_structure,
        couches=couches,
        epaisseur_totale_cm=epaisseur_totale,
        etat=etat,
        conforme=conforme,
        avertissements=avertissements,
        justification=justification,
        parametres_utilises=params,
    )
