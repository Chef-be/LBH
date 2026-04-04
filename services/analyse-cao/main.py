#!/usr/bin/env python3
# ============================================================
# Service Analyse CAO — ezdxf + FastAPI
# Plateforme BEE — Bureau d'Études Économiste
# Port : 8012
# Formats : DXF (natif), DWG (via conversion externe si disponible)
# ============================================================

import os
import io
import logging
from datetime import datetime
from contextlib import asynccontextmanager
from typing import Optional

import ezdxf
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

journal = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

FORMATS_ACCEPTES = set(os.environ.get("ANALYSE_CAO_FORMATS_ACCEPTES", "dxf").split(","))


# ------------------------------------------------------------
# Cycle de vie
# ------------------------------------------------------------
@asynccontextmanager
async def duree_de_vie(application: FastAPI):
    journal.info("Service Analyse CAO démarré — formats : %s", FORMATS_ACCEPTES)
    yield
    journal.info("Service Analyse CAO arrêté.")


# ------------------------------------------------------------
# Application
# ------------------------------------------------------------
app = FastAPI(
    title="Service Analyse CAO — Plateforme BEE",
    description="Analyse de fichiers DXF/DWG pour extraction de géométries et métadonnées",
    version="0.1.0",
    lifespan=duree_de_vie,
    docs_url="/documentation",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ------------------------------------------------------------
# Modèles
# ------------------------------------------------------------
class StatistiquesEntites(BaseModel):
    lignes: int
    polylignes: int
    cercles: int
    arcs: int
    textes: int
    hachures: int
    blocs: int
    cotes: int
    total: int


class ResultatAnalyseCAO(BaseModel):
    succes: bool
    format: str
    version_dxf: str
    nb_calques: int
    calques: list[str]
    nb_entites: int
    statistiques_entites: StatistiquesEntites
    emprise: Optional[dict]
    horodatage: str


class ReponseEtat(BaseModel):
    statut: str
    service: str
    version: str
    formats_supportes: list[str]
    horodatage: str


# ------------------------------------------------------------
# Utilitaires
# ------------------------------------------------------------
def calculer_emprise(document) -> Optional[dict]:
    """Calcule l'emprise géographique (bounding box) du dessin."""
    try:
        xmin = ymin = float("inf")
        xmax = ymax = float("-inf")
        modelspace = document.modelspace()
        for entite in modelspace:
            if hasattr(entite.dxf, "insert"):
                pt = entite.dxf.insert
                xmin, ymin = min(xmin, pt.x), min(ymin, pt.y)
                xmax, ymax = max(xmax, pt.x), max(ymax, pt.y)
        if xmin == float("inf"):
            return None
        return {"xmin": round(xmin, 3), "ymin": round(ymin, 3), "xmax": round(xmax, 3), "ymax": round(ymax, 3),
                "largeur": round(xmax - xmin, 3), "hauteur": round(ymax - ymin, 3)}
    except Exception:
        return None


def compter_entites(modelspace) -> StatistiquesEntites:
    """Compte les entités par type dans le modelspace."""
    compteurs = {"LINE": 0, "LWPOLYLINE": 0, "CIRCLE": 0, "ARC": 0,
                 "TEXT": 0, "MTEXT": 0, "HATCH": 0, "INSERT": 0,
                 "DIMENSION": 0}
    for entite in modelspace:
        t = entite.dxftype()
        if t in compteurs:
            compteurs[t] += 1
    return StatistiquesEntites(
        lignes=compteurs["LINE"],
        polylignes=compteurs["LWPOLYLINE"],
        cercles=compteurs["CIRCLE"],
        arcs=compteurs["ARC"],
        textes=compteurs["TEXT"] + compteurs["MTEXT"],
        hachures=compteurs["HATCH"],
        blocs=compteurs["INSERT"],
        cotes=compteurs["DIMENSION"],
        total=sum(compteurs.values()),
    )


# ------------------------------------------------------------
# Routes
# ------------------------------------------------------------
@app.get("/sante", response_model=ReponseEtat, tags=["Supervision"])
async def sante():
    return ReponseEtat(
        statut="actif",
        service="analyse-cao-bee",
        version="0.1.0",
        formats_supportes=sorted(FORMATS_ACCEPTES),
        horodatage=datetime.now().isoformat(),
    )


@app.post("/cao/analyser", response_model=ResultatAnalyseCAO, tags=["Analyse CAO"])
async def analyser_fichier_cao(
    fichier: UploadFile = File(..., description="Fichier DXF ou DWG à analyser"),
):
    """Analyse un fichier CAO DXF et extrait ses métadonnées, calques et entités."""
    extension = (fichier.filename or "").rsplit(".", 1)[-1].lower()

    if extension not in FORMATS_ACCEPTES:
        raise HTTPException(
            status_code=415,
            detail=f"Format '{extension}' non supporté. Formats acceptés : {', '.join(sorted(FORMATS_ACCEPTES))}",
        )
    if extension == "dwg":
        raise HTTPException(
            status_code=415,
            detail="Le format DWG n'est pas encore supporté en traitement direct. Convertir en DXF d'abord.",
        )

    contenu = await fichier.read()

    try:
        document = ezdxf.read(io.StringIO(contenu.decode("utf-8", errors="replace")))
        version = document.dxfversion

        calques = [calque.dxf.name for calque in document.layers]
        modelspace = document.modelspace()
        stats = compter_entites(modelspace)
        nb_entites_total = sum(1 for _ in modelspace)
        emprise = calculer_emprise(document)

        journal.info(
            "Analyse CAO terminée — %d calques, %d entités",
            len(calques), nb_entites_total,
        )

        return ResultatAnalyseCAO(
            succes=True,
            format=extension.upper(),
            version_dxf=version,
            nb_calques=len(calques),
            calques=calques[:100],  # Limité à 100 calques dans la réponse
            nb_entites=nb_entites_total,
            statistiques_entites=stats,
            emprise=emprise,
            horodatage=datetime.now().isoformat(),
        )
    except Exception as e:
        journal.error("Erreur analyse CAO : %s", str(e))
        raise HTTPException(status_code=500, detail=f"Erreur lors de l'analyse : {str(e)}")


@app.get("/", tags=["Général"])
async def racine():
    return {"service": "Analyse CAO Plateforme BEE", "version": "0.1.0", "documentation": "/documentation"}
