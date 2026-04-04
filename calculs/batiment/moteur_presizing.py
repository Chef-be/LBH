"""
Moteur de pré-dimensionnement bâtiment — Plateforme BEE.
Estimation rapide du coût de construction à partir des surfaces de locaux.

Méthode : coût/m² × surfaces par type de local, avec facteurs correctifs
pour le nombre de niveaux, la zone géographique et le type d'opération.
"""

from __future__ import annotations

import decimal
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from applications.batiment.models import ProgrammeBatiment


# ---------------------------------------------------------------------------
# Facteurs correctifs (tous paramétrables via le modèle Parametre en prod)
# ---------------------------------------------------------------------------

FACTEURS_OPERATION = {
    "construction_neuve": decimal.Decimal("1.00"),
    "rehabilitation": decimal.Decimal("0.75"),
    "extension": decimal.Decimal("1.10"),
    "renovation_lourde": decimal.Decimal("0.85"),
    "demolition_reconstruction": decimal.Decimal("1.05"),
}

# Chaque niveau sous-sol coûte 40 % de plus qu'un niveau courant
SURCOAT_SOUS_SOL_PAR_NIVEAU = decimal.Decimal("0.40")

# Au-delà de 3 niveaux hors-sol, majoration de 5 % par niveau supplémentaire
SEUIL_NIVEAUX_HS = 3
SURCOAT_NIVEAUX_HS_PAR_NIVEAU = decimal.Decimal("0.05")


@dataclass
class ResultatCalculBatiment:
    shon_totale: decimal.Decimal
    shab_totale: decimal.Decimal
    surface_utile_totale: decimal.Decimal
    nb_locaux: int
    cout_par_m2: decimal.Decimal
    facteur_operation: decimal.Decimal
    facteur_niveaux: decimal.Decimal
    cout_par_m2_corrige: decimal.Decimal
    cout_estime_ht: decimal.Decimal
    cout_par_m2_shon_ht: decimal.Decimal
    detail_locaux: list[dict] = field(default_factory=list)
    avertissements: list[str] = field(default_factory=list)


def calculer_programme(
    programme: "ProgrammeBatiment",
    cout_unitaire_m2: float | decimal.Decimal,
) -> dict:
    """
    Calcule les surfaces totales et le coût estimatif d'un programme bâtiment.

    :param programme: Instance ProgrammeBatiment avec ses locaux prefetch_related.
    :param cout_unitaire_m2: Coût de référence au m² SHON, HT (€/m²).
    :return: Dictionnaire JSON-compatible avec les résultats du calcul.
    """
    cout_ref = decimal.Decimal(str(cout_unitaire_m2))
    avertissements = []
    detail_locaux = []

    # --- Surfaces ---
    surface_totale = decimal.Decimal("0")
    for local in programme.locaux.all():
        s = decimal.Decimal(str(local.nombre)) * decimal.Decimal(str(local.surface_unitaire_m2))
        surface_totale += s
        detail_locaux.append({
            "designation": local.designation,
            "categorie": local.categorie,
            "nombre": local.nombre,
            "surface_unitaire_m2": float(local.surface_unitaire_m2),
            "surface_totale_m2": float(s),
        })

    if surface_totale == 0:
        avertissements.append(
            "Aucun local renseigné — le coût calculé est nul."
        )

    # SHON estimée = surface utile × 1.15 (coefficient forfaitaire circulations + murs)
    coefficient_shon = decimal.Decimal("1.15")
    shon = surface_totale * coefficient_shon

    # --- Facteur type d'opération ---
    facteur_op = FACTEURS_OPERATION.get(
        programme.type_operation, decimal.Decimal("1.00")
    )

    # --- Facteur nombre de niveaux ---
    facteur_niveaux = decimal.Decimal("1.00")

    nhs = programme.nombre_niveaux_hors_sol or 1
    if nhs > SEUIL_NIVEAUX_HS:
        surcoat_hs = SURCOAT_NIVEAUX_HS_PAR_NIVEAU * (nhs - SEUIL_NIVEAUX_HS)
        facteur_niveaux += surcoat_hs

    nss = programme.nombre_niveaux_sous_sol or 0
    if nss > 0:
        facteur_niveaux += SURCOAT_SOUS_SOL_PAR_NIVEAU * nss

    # --- Coût corrigé ---
    cout_corrige = (cout_ref * facteur_op * facteur_niveaux).quantize(
        decimal.Decimal("0.01")
    )

    # --- Coût total HT ---
    cout_total = (shon * cout_corrige).quantize(decimal.Decimal("0.01"))

    cout_par_m2_shon = (
        (cout_total / shon).quantize(decimal.Decimal("0.01"))
        if shon > 0
        else decimal.Decimal("0")
    )

    return {
        "shon_totale": float(shon),
        "shab_totale": float(
            programme.shab_totale if programme.shab_totale else surface_totale
        ),
        "surface_utile_totale": float(surface_totale),
        "nb_locaux": len(detail_locaux),
        "cout_par_m2": float(cout_ref),
        "facteur_operation": float(facteur_op),
        "facteur_niveaux": float(facteur_niveaux),
        "cout_par_m2_corrige": float(cout_corrige),
        "cout_estime_ht": float(cout_total),
        "cout_par_m2_shon_ht": float(cout_par_m2_shon),
        "detail_locaux": detail_locaux,
        "avertissements": avertissements,
    }
