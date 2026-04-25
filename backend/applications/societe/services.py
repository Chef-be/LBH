"""
Services métier — Module Société.
"""

from __future__ import annotations

import uuid
from decimal import Decimal
from html import escape
from typing import Any

from django.template.loader import render_to_string

from applications.projets.models import MissionClient
from applications.site_public.models import ConfigurationSite


def lister_missions_livrables(
    *,
    famille_client: str = "",
    sous_type_client: str = "",
    nature_ouvrage: str = "",
) -> list[dict[str, Any]]:
    missions_qs = MissionClient.objects.filter(est_active=True).prefetch_related("livrables")

    if famille_client:
        missions_qs = missions_qs.filter(famille_client=famille_client)
    if nature_ouvrage:
        missions_qs = missions_qs.filter(nature_ouvrage__in=[nature_ouvrage, "tous"])

    missions: list[dict[str, Any]] = []
    for mission in missions_qs:
        if sous_type_client and mission.sous_types_client and sous_type_client not in mission.sous_types_client:
            continue

        livrables = [
            {
                "id": str(livrable.id),
                "code": livrable.code,
                "libelle": livrable.libelle,
                "type_document": livrable.type_document,
                "format_attendu": livrable.format_attendu,
                "icone": livrable.icone,
                "couleur": livrable.couleur,
            }
            for livrable in mission.livrables.filter(est_active=True).order_by("ordre", "libelle")
        ]

        missions.append({
            "id": str(mission.id),
            "code": mission.code,
            "libelle": mission.libelle,
            "description": mission.description,
            "famille_client": mission.famille_client,
            "nature_ouvrage": mission.nature_ouvrage,
            "phases_concernees": mission.phases_concernees,
            "icone": mission.icone,
            "couleur": mission.couleur,
            "est_obligatoire": mission.est_obligatoire,
            "livrables": livrables,
        })
    return missions


def construire_suggestions_prestations(missions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    suggestions: list[dict[str, Any]] = []
    for ordre, mission in enumerate(missions):
        livrables = mission.get("livrables", [])
        libelles_livrables = [livrable["libelle"] for livrable in livrables]
        designation = mission["libelle"]
        if libelles_livrables:
            designation = f"{designation} — {', '.join(libelles_livrables)}"

        description = (mission.get("description") or "").strip()
        if libelles_livrables:
            suffixe = f"Livrables: {', '.join(libelles_livrables)}."
            description = f"{description}\n\n{suffixe}".strip()

        suggestions.append({
            "ordre": ordre,
            "mission_code": mission["code"],
            "intitule": designation,
            "description": description,
            "phase_code": (mission.get("phases_concernees") or [""])[0] or "",
            "livrables_codes": [livrable["code"] for livrable in livrables],
            "livrables_labels": libelles_livrables,
            "type_ligne": "forfait",
            "quantite": "1",
            "unite": "forfait",
        })
    return suggestions


def construire_contexte_projet_saisi(
    *,
    famille_client: str,
    sous_type_client: str,
    contexte_contractuel: str,
    nature_ouvrage: str,
    nature_marche: str,
    role_lbh: str,
    missions_selectionnees: list[dict[str, Any]],
) -> dict[str, Any]:
    mission_principale = missions_selectionnees[0]["missionCode"] if missions_selectionnees else ""
    return {
        "famille_client": famille_client,
        "sous_type_client": sous_type_client,
        "contexte_contractuel": contexte_contractuel,
        "mission_principale": mission_principale,
        "missions_associees": [mission["missionCode"] for mission in missions_selectionnees],
        "livrables_selectionnes": [
            code
            for mission in missions_selectionnees
            for code in mission.get("livrablesCodes", [])
        ],
        "phase_intervention": "",
        "nature_ouvrage": nature_ouvrage,
        "nature_marche": nature_marche,
        "role_lbh": role_lbh,
        "methode_estimation": "",
        "donnees_entree": {},
    }


def generer_jeton_validation() -> str:
    return uuid.uuid4().hex


def _echapper_pdf_texte(valeur: str) -> str:
    return (
        valeur.replace("€", "EUR")
        .replace("\\", "\\\\")
        .replace("(", "\\(")
        .replace(")", "\\)")
        .replace("\r", " ")
        .replace("\n", "\\n")
    )


def _pdf_texte_simple(lignes: list[str], titre: str) -> bytes:
    flux = ["BT", "/F1 16 Tf", "40 800 Td", f"({_echapper_pdf_texte(titre)}) Tj", "/F1 10 Tf"]
    y = 780
    for ligne in lignes:
        if y <= 40:
            break
        y -= 14
        flux.append(f"1 0 0 1 40 {y} Tm ({_echapper_pdf_texte(ligne)}) Tj")
    contenu = "\n".join(flux) + "\nET"
    objet_flux = f"<< /Length {len(contenu.encode('latin-1', errors='ignore'))} >>\nstream\n{contenu}\nendstream"

    objets = [
        "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
        "2 0 obj << /Type /Pages /Count 1 /Kids [3 0 R] >> endobj",
        "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj",
        f"4 0 obj\n{objet_flux}\nendobj",
        "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    ]

    contenu_pdf = ["%PDF-1.4"]
    offsets = [0]
    total = len("%PDF-1.4\n".encode("latin-1"))
    for objet in objets:
        offsets.append(total)
        bloc = f"{objet}\n"
        contenu_pdf.append(bloc)
        total += len(bloc.encode("latin-1", errors="ignore"))

    xref_offset = total
    contenu_pdf.append(f"xref\n0 {len(offsets)}\n")
    contenu_pdf.append("0000000000 65535 f \n")
    for offset in offsets[1:]:
        contenu_pdf.append(f"{offset:010d} 00000 n \n")
    contenu_pdf.append(
        f"trailer << /Size {len(offsets)} /Root 1 0 R >>\nstartxref\n{xref_offset}\n%%EOF"
    )
    return "".join(contenu_pdf).encode("latin-1", errors="ignore")


def generer_pdf_devis(devis, *, validation_url: str = "", base_url: str = "") -> bytes:
    configuration = ConfigurationSite.obtenir()
    logo_url = ""
    if configuration.logo:
        if base_url and configuration.logo.url.startswith("/"):
            logo_url = f"{base_url.rstrip('/')}{configuration.logo.url}"
        else:
            logo_url = configuration.logo.url

    lignes = list(devis.lignes.order_by("ordre"))
    missions = devis.missions_selectionnees or []
    html = render_to_string(
        "societe/devis_honoraires_pdf.html",
        {
            "configuration": configuration,
            "devis": devis,
            "lignes": lignes,
            "missions": missions,
            "logo_url": logo_url,
            "validation_url": validation_url,
        },
    )

    try:
        from weasyprint import HTML
    except Exception:
        lignes_texte = [
            f"Référence : {devis.reference}",
            f"Client : {devis.client_nom}",
            f"Intitulé : {devis.intitule}",
            f"Montant HT : {devis.montant_ht} €",
            f"Montant TTC : {devis.montant_ttc} €",
            "",
        ]
        for ligne in lignes:
            montant = getattr(ligne, "montant_ht", Decimal("0"))
            lignes_texte.append(f"- {ligne.intitule} | {montant} € HT")
        if validation_url:
            lignes_texte.extend(["", f"Validation : {validation_url}"])
        return _pdf_texte_simple(lignes_texte, f"Devis {devis.reference}")

    return HTML(string=html, base_url=base_url or None).write_pdf()


def rendu_validation_html(titre: str, message: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>{escape(titre)}</title>
  <style>
    body {{
      margin: 0;
      font-family: Arial, sans-serif;
      background: #f8fafc;
      color: #0f172a;
    }}
    .page {{
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }}
    .carte {{
      width: 100%;
      max-width: 560px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 20px;
      padding: 32px;
      box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
    }}
    h1 {{
      margin: 0 0 12px 0;
      font-size: 28px;
    }}
    p {{
      margin: 0;
      line-height: 1.6;
      color: #475569;
    }}
  </style>
</head>
<body>
  <div class="page">
    <div class="carte">
      <h1>{escape(titre)}</h1>
      <p>{escape(message)}</p>
    </div>
  </div>
</body>
</html>"""
