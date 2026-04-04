"""
Moteur de calcul de rentabilité — Plateforme BEE
Bureau d'Études Économiste

Version : 1.0.0
Toutes les formules sont documentées et référencées dans matrices/calculs.md.
Aucune constante métier en dur — tout passe par les paramètres.
"""

from decimal import Decimal, ROUND_HALF_UP
from dataclasses import dataclass, field
from typing import Optional
from enum import Enum


class EtatRentabilite(str, Enum):
    RENTABLE = "rentable"
    SURVEILLER = "surveiller"
    FAIBLE = "faible"
    NON_RENTABLE = "non_rentable"
    SOUS_CONDITION = "sous_condition"
    DEFICITAIRE_ORIGINE = "deficitaire_origine"
    INDEFINI = "indefini"


@dataclass
class ParametresCalcul:
    """
    Paramètres utilisés par le moteur de calcul.
    Fournis par les paramètres système ou surchargés au niveau de l'étude.
    """
    taux_frais_chantier: Decimal = Decimal("0.12")
    taux_frais_generaux: Decimal = Decimal("0.10")
    taux_aleas: Decimal = Decimal("0.03")
    taux_marge_cible: Decimal = Decimal("0.08")
    taux_pertes: Decimal = Decimal("0.05")
    taux_charges_sociales: Decimal = Decimal("0.85")
    heures_productives_annuelles: int = 1600
    seuil_alerte_marge: Decimal = Decimal("0.03")
    seuil_danger_marge: Decimal = Decimal("0.00")


@dataclass
class ComposantesDebourse:
    """Décomposition du déboursé sec unitaire."""
    temps_main_oeuvre: Decimal = Decimal("0")       # h/u
    cout_horaire_mo: Decimal = Decimal("0")         # €/h
    cout_matieres: Decimal = Decimal("0")           # €/u
    cout_materiel: Decimal = Decimal("0")           # €/u
    cout_sous_traitance: Decimal = Decimal("0")     # €/u
    cout_transport: Decimal = Decimal("0")          # €/u


@dataclass
class ResultatLigne:
    """Résultat complet du calcul économique d'une ligne de prix."""
    # Données d'entrée
    quantite_prevue: Decimal = Decimal("0")
    quantite_reelle: Optional[Decimal] = None

    # Déboursé sec
    debourse_sec_unitaire: Decimal = Decimal("0")    # DSu = MO + Mat + Maté + ST + Transp
    debourse_sec_total: Decimal = Decimal("0")       # DS = DSu × Q

    # Coûts
    cout_direct_unitaire: Decimal = Decimal("0")     # CDu = DSu × (1 + τpertes) × (1 + τFC)
    cout_revient_unitaire: Decimal = Decimal("0")    # CRu = CDu × (1 + τFG) × (1 + τaléas)

    # Prix de vente
    prix_vente_unitaire: Decimal = Decimal("0")      # PVu = CRu / (1 - τmarge)

    # Marges unitaires
    marge_brute_unitaire: Decimal = Decimal("0")     # MBu = PVu - DSu
    marge_nette_unitaire: Decimal = Decimal("0")     # MNu = PVu - CRu

    # Marges totales
    marge_brute_totale: Decimal = Decimal("0")
    marge_nette_totale: Decimal = Decimal("0")

    # Taux de marge
    taux_marge_brute: Decimal = Decimal("0")         # MBu / PVu
    taux_marge_nette: Decimal = Decimal("0")         # MNu / PVu

    # Seuils critiques
    seuil_quantite_critique: Optional[Decimal] = None  # Q pour MN = 0
    seuil_prix_minimum: Decimal = Decimal("0")          # PV pour MN = 0
    seuil_prix_cible: Decimal = Decimal("0")            # PV pour MN = marge_cible

    # Sensibilités
    indice_sensibilite_quantite: Decimal = Decimal("0")
    indice_sensibilite_main_oeuvre: Decimal = Decimal("0")
    indice_sensibilite_matieres: Decimal = Decimal("0")

    # Rentabilité
    etat_rentabilite: EtatRentabilite = EtatRentabilite.INDEFINI
    causes_non_rentabilite: list = field(default_factory=list)
    contribution_marge: Decimal = Decimal("0")  # % du total lot

    # Taux effectifs utilisés dans le calcul
    taux_pertes_utilise: Decimal = Decimal("0")
    taux_frais_chantier_utilise: Decimal = Decimal("0")
    taux_frais_generaux_utilise: Decimal = Decimal("0")
    taux_aleas_utilise: Decimal = Decimal("0")
    taux_marge_utilise: Decimal = Decimal("0")


def d(valeur) -> Decimal:
    """Convertit en Decimal avec gestion des None et des flottants."""
    if valeur is None:
        return Decimal("0")
    return Decimal(str(valeur))


def arrondir(valeur: Decimal, decimales: int = 4) -> Decimal:
    """Arrondit un Decimal au nombre de décimales spécifié."""
    quantification = Decimal(f"0.{'0' * decimales}")
    return valeur.quantize(quantification, rounding=ROUND_HALF_UP)


def calculer_debourse_sec_unitaire(composantes: ComposantesDebourse) -> Decimal:
    """
    DSu = (T_MO × C_MO) + C_Mat + C_Maté + C_ST + C_Transp
    Référence : matrices/calculs.md §2.1
    """
    mo = d(composantes.temps_main_oeuvre) * d(composantes.cout_horaire_mo)
    return arrondir(
        mo
        + d(composantes.cout_matieres)
        + d(composantes.cout_materiel)
        + d(composantes.cout_sous_traitance)
        + d(composantes.cout_transport)
    )


def calculer_cout_direct_unitaire(
    debourse_sec_unitaire: Decimal,
    taux_pertes: Decimal,
    taux_frais_chantier: Decimal,
) -> Decimal:
    """
    CDu = DSu × (1 + τ_pertes) × (1 + τ_frais_chantier)
    Référence : matrices/calculs.md §2.1
    """
    return arrondir(
        d(debourse_sec_unitaire)
        * (Decimal("1") + d(taux_pertes))
        * (Decimal("1") + d(taux_frais_chantier))
    )


def calculer_cout_revient_unitaire(
    cout_direct_unitaire: Decimal,
    taux_frais_generaux: Decimal,
    taux_aleas: Decimal,
) -> Decimal:
    """
    CRu = CDu × (1 + τ_FG) × (1 + τ_aléas)
    Référence : matrices/calculs.md §2.1
    """
    return arrondir(
        d(cout_direct_unitaire)
        * (Decimal("1") + d(taux_frais_generaux))
        * (Decimal("1") + d(taux_aleas))
    )


def calculer_prix_vente_unitaire(
    cout_revient_unitaire: Decimal,
    taux_marge: Decimal,
) -> Decimal:
    """
    PVu = CRu / (1 - τ_marge)
    ATTENTION : τ_marge ici est le taux sur prix de vente (≠ taux sur coût).
    Référence : matrices/calculs.md §2.1
    """
    taux = d(taux_marge)
    if taux >= Decimal("1"):
        raise ValueError(f"Le taux de marge ne peut pas être ≥ 100% (valeur : {taux})")
    return arrondir(d(cout_revient_unitaire) / (Decimal("1") - taux))


def detecter_etat_rentabilite(
    taux_marge_nette: Decimal,
    debourse_sec_unitaire: Decimal,
    prix_vente_unitaire: Decimal,
    cout_revient_unitaire: Decimal,
    quantite_prevue: Decimal,
    seuil_quantite_critique: Optional[Decimal],
    params: ParametresCalcul,
) -> EtatRentabilite:
    """
    Détermine l'état de rentabilité selon les seuils configurés.
    Référence : matrices/calculs.md §2.4
    """
    tau = d(taux_marge_nette)
    dsu = d(debourse_sec_unitaire)
    pvu = d(prix_vente_unitaire)
    cru = d(cout_revient_unitaire)

    # Déficitaire dès l'origine : le DSu dépasse déjà le PV
    if dsu > pvu:
        return EtatRentabilite.DEFICITAIRE_ORIGINE

    # Non rentable : le CRu dépasse le PV
    if cru > pvu:
        return EtatRentabilite.NON_RENTABLE

    # Rentable sous condition de quantité
    if seuil_quantite_critique is not None and quantite_prevue < seuil_quantite_critique:
        return EtatRentabilite.SOUS_CONDITION

    # Classification par taux de marge nette
    if tau < params.seuil_danger_marge:
        return EtatRentabilite.NON_RENTABLE
    elif tau < params.seuil_alerte_marge:
        return EtatRentabilite.FAIBLE
    elif tau < params.taux_marge_cible:
        return EtatRentabilite.SURVEILLER
    else:
        return EtatRentabilite.RENTABLE


def expliquer_non_rentabilite(
    composantes: ComposantesDebourse,
    debourse_sec_unitaire: Decimal,
    taux_marge_nette: Decimal,
    params: ParametresCalcul,
    etat: EtatRentabilite,
) -> list:
    """
    Identifie les causes de non-rentabilité ou de faiblesse de marge.
    Retourne une liste de messages explicatifs en français.
    """
    causes = []
    dsu = d(debourse_sec_unitaire)
    if dsu == Decimal("0"):
        return causes

    # Part de chaque composante dans le DSu
    mo_total = d(composantes.temps_main_oeuvre) * d(composantes.cout_horaire_mo)
    part_mo = mo_total / dsu if dsu > 0 else Decimal("0")
    part_mat = d(composantes.cout_matieres) / dsu if dsu > 0 else Decimal("0")
    part_maté = d(composantes.cout_materiel) / dsu if dsu > 0 else Decimal("0")
    part_st = d(composantes.cout_sous_traitance) / dsu if dsu > 0 else Decimal("0")
    part_transp = d(composantes.cout_transport) / dsu if dsu > 0 else Decimal("0")

    seuil_dominant = Decimal("0.40")  # Part > 40% = dominante

    if part_mo > seuil_dominant:
        causes.append(f"Main-d'œuvre dominante ({part_mo:.0%} du déboursé sec) — vérifier le rendement ou le coût horaire.")
    if part_mat > seuil_dominant:
        causes.append(f"Coût matières dominant ({part_mat:.0%}) — renégocier les approvisionnements.")
    if part_maté > Decimal("0.20"):
        causes.append(f"Coût matériel élevé ({part_maté:.0%}) — optimiser l'amortissement ou mutualiser.")
    if part_st > seuil_dominant:
        causes.append(f"Sous-traitance dominante ({part_st:.0%}) — vérifier les marges des sous-traitants.")
    if part_transp > Decimal("0.15"):
        causes.append(f"Coût de transport significatif ({part_transp:.0%}) — optimiser la logistique.")

    if params.taux_frais_chantier > Decimal("0.15"):
        causes.append(f"Frais de chantier élevés ({params.taux_frais_chantier:.0%}) — vérifier le dimensionnement du chantier.")
    if params.taux_frais_generaux > Decimal("0.12"):
        causes.append(f"Frais généraux élevés ({params.taux_frais_generaux:.0%}).")

    tau = d(taux_marge_nette)
    if etat == EtatRentabilite.NON_RENTABLE and tau >= Decimal("0"):
        causes.append("Les frais indirects (frais généraux + aléas) absorbent toute la marge.")
    if etat == EtatRentabilite.DEFICITAIRE_ORIGINE:
        causes.append("Le prix de vente ne couvre pas le déboursé sec — la ligne est déficitaire indépendamment des frais indirects.")

    return causes if causes else ["Aucune cause dominante identifiée — analyser en détail les hypothèses."]


def calculer_ligne(
    composantes: ComposantesDebourse,
    quantite_prevue: Decimal,
    params: ParametresCalcul,
    taux_pertes_surcharge: Optional[Decimal] = None,
    taux_frais_chantier_surcharge: Optional[Decimal] = None,
    taux_frais_generaux_surcharge: Optional[Decimal] = None,
    taux_aleas_surcharge: Optional[Decimal] = None,
    taux_marge_surcharge: Optional[Decimal] = None,
    frais_fixes_lot: Optional[Decimal] = None,
    prix_vente_unitaire_force: Optional[Decimal] = None,
    quantite_reelle: Optional[Decimal] = None,
) -> ResultatLigne:
    """
    Calcule tous les indicateurs économiques d'une ligne de prix.
    Utilise les taux surchargés si fournis, sinon les paramètres système.

    Args:
        composantes: Décomposition du déboursé sec
        quantite_prevue: Quantité prévisionnelle
        params: Paramètres système (peuvent être surchargés)
        *_surcharge: Taux surchargés au niveau de la ligne (priorité sur params)
        frais_fixes_lot: Frais fixes du lot pour le calcul du seuil de quantité
        prix_vente_unitaire_force: PVu imposé (ex: depuis le marché) — si fourni,
            la marge est calculée à rebours depuis ce prix
        quantite_reelle: Quantité réelle (suivi d'exécution)
    """
    q = d(quantite_prevue)
    if q <= Decimal("0"):
        raise ValueError("La quantité prévue doit être supérieure à zéro.")

    # Résolution des taux effectifs (surcharge > étude > paramètres)
    tau_pertes = d(taux_pertes_surcharge) if taux_pertes_surcharge is not None else d(params.taux_pertes)
    tau_fc = d(taux_frais_chantier_surcharge) if taux_frais_chantier_surcharge is not None else d(params.taux_frais_chantier)
    tau_fg = d(taux_frais_generaux_surcharge) if taux_frais_generaux_surcharge is not None else d(params.taux_frais_generaux)
    tau_aleas = d(taux_aleas_surcharge) if taux_aleas_surcharge is not None else d(params.taux_aleas)
    tau_marge = d(taux_marge_surcharge) if taux_marge_surcharge is not None else d(params.taux_marge_cible)

    # Calcul des coûts
    dsu = calculer_debourse_sec_unitaire(composantes)
    cdu = calculer_cout_direct_unitaire(dsu, tau_pertes, tau_fc)
    cru = calculer_cout_revient_unitaire(cdu, tau_fg, tau_aleas)

    # Prix de vente
    if prix_vente_unitaire_force is not None:
        pvu = d(prix_vente_unitaire_force)
        # Recalcul de la marge réelle
        mnu = arrondir(pvu - cru)
        tau_marge_reel = arrondir(mnu / pvu) if pvu > Decimal("0") else Decimal("0")
    else:
        pvu = calculer_prix_vente_unitaire(cru, tau_marge)
        tau_marge_reel = tau_marge

    # Marges unitaires
    mbu = arrondir(pvu - dsu)
    mnu = arrondir(pvu - cru)

    # Taux de marge
    tau_mb = arrondir(mbu / pvu) if pvu > Decimal("0") else Decimal("0")
    tau_mn = arrondir(mnu / pvu) if pvu > Decimal("0") else Decimal("0")

    # Totaux
    ds_total = arrondir(dsu * q, 2)
    mb_total = arrondir(mbu * q, 2)
    mn_total = arrondir(mnu * q, 2)

    # Seuils critiques
    seuil_pv_min = cru  # PV minimum = CRu (marge nulle)
    seuil_pv_cible = calculer_prix_vente_unitaire(cru, params.taux_marge_cible)
    seuil_q_critique = None
    if frais_fixes_lot is not None and mnu > Decimal("0"):
        seuil_q_critique = arrondir(d(frais_fixes_lot) / mnu, 3)

    # Sensibilités
    is_q = arrondir(mnu / cru * 100) if cru > Decimal("0") else Decimal("0")
    mo_total = d(composantes.temps_main_oeuvre) * d(composantes.cout_horaire_mo)
    is_mo = arrondir(mo_total / dsu * 100) if dsu > Decimal("0") else Decimal("0")
    is_mat = arrondir(d(composantes.cout_matieres) / dsu * 100) if dsu > Decimal("0") else Decimal("0")

    # État de rentabilité
    etat = detecter_etat_rentabilite(
        tau_mn, dsu, pvu, cru, q, seuil_q_critique, params,
    )

    # Causes de non-rentabilité
    causes = []
    if etat not in (EtatRentabilite.RENTABLE, EtatRentabilite.INDEFINI):
        causes = expliquer_non_rentabilite(composantes, dsu, tau_mn, params, etat)

    return ResultatLigne(
        quantite_prevue=q,
        quantite_reelle=d(quantite_reelle) if quantite_reelle is not None else None,
        debourse_sec_unitaire=dsu,
        debourse_sec_total=ds_total,
        cout_direct_unitaire=cdu,
        cout_revient_unitaire=cru,
        prix_vente_unitaire=pvu,
        marge_brute_unitaire=mbu,
        marge_nette_unitaire=mnu,
        marge_brute_totale=mb_total,
        marge_nette_totale=mn_total,
        taux_marge_brute=tau_mb,
        taux_marge_nette=tau_mn,
        seuil_quantite_critique=seuil_q_critique,
        seuil_prix_minimum=seuil_pv_min,
        seuil_prix_cible=seuil_pv_cible,
        indice_sensibilite_quantite=is_q,
        indice_sensibilite_main_oeuvre=is_mo,
        indice_sensibilite_matieres=is_mat,
        etat_rentabilite=etat,
        causes_non_rentabilite=causes,
        taux_pertes_utilise=tau_pertes,
        taux_frais_chantier_utilise=tau_fc,
        taux_frais_generaux_utilise=tau_fg,
        taux_aleas_utilise=tau_aleas,
        taux_marge_utilise=tau_marge_reel,
    )


def simuler_variation(
    resultat_base: ResultatLigne,
    composantes: ComposantesDebourse,
    params: ParametresCalcul,
    variation_quantite_pct: Optional[Decimal] = None,
    variation_cout_mo_pct: Optional[Decimal] = None,
    variation_cout_matieres_pct: Optional[Decimal] = None,
    variation_prix_vente_pct: Optional[Decimal] = None,
) -> ResultatLigne:
    """
    Simule l'impact d'une variation sur les résultats.
    Retourne un nouveau ResultatLigne avec les hypothèses modifiées.
    """
    composantes_sim = ComposantesDebourse(
        temps_main_oeuvre=composantes.temps_main_oeuvre,
        cout_horaire_mo=d(composantes.cout_horaire_mo) * (
            Decimal("1") + d(variation_cout_mo_pct or Decimal("0")) / 100
        ),
        cout_matieres=d(composantes.cout_matieres) * (
            Decimal("1") + d(variation_cout_matieres_pct or Decimal("0")) / 100
        ),
        cout_materiel=composantes.cout_materiel,
        cout_sous_traitance=composantes.cout_sous_traitance,
        cout_transport=composantes.cout_transport,
    )

    q_sim = d(resultat_base.quantite_prevue) * (
        Decimal("1") + d(variation_quantite_pct or Decimal("0")) / 100
    )

    pvu_force = None
    if variation_prix_vente_pct is not None:
        pvu_force = d(resultat_base.prix_vente_unitaire) * (
            Decimal("1") + d(variation_prix_vente_pct) / 100
        )

    return calculer_ligne(
        composantes=composantes_sim,
        quantite_prevue=q_sim,
        params=params,
        prix_vente_unitaire_force=pvu_force,
    )
