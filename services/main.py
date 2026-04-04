#!/usr/bin/env python3
# ============================================================
# Services FastAPI — Agrégateur principal
# Plateforme BEE — Bureau d'Études Économiste
# Port : 8001
# ============================================================

import os
import logging
from datetime import datetime
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, HTTPException, Depends, Security
from fastapi.security.api_key import APIKeyHeader
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

structlog_disponible = False
try:
    import structlog
    structlog_disponible = True
    journal = structlog.get_logger()
except ImportError:
    journal = logging.getLogger(__name__)

# ------------------------------------------------------------
# Configuration
# ------------------------------------------------------------
SECRET_API = os.environ.get("SECRET_API", "")
OCR_HOTE = os.environ.get("OCR_HOTE", "bee-ocr")
OCR_PORT = os.environ.get("OCR_PORT", "8010")
ANALYSE_PDF_HOTE = os.environ.get("ANALYSE_PDF_HOTE", "bee-analyse-pdf")
ANALYSE_PDF_PORT = os.environ.get("ANALYSE_PDF_PORT", "8011")
ANALYSE_CAO_HOTE = os.environ.get("ANALYSE_CAO_HOTE", "bee-analyse-cao")
ANALYSE_CAO_PORT = os.environ.get("ANALYSE_CAO_PORT", "8012")

URL_OCR = f"http://{OCR_HOTE}:{OCR_PORT}"
URL_ANALYSE_PDF = f"http://{ANALYSE_PDF_HOTE}:{ANALYSE_PDF_PORT}"
URL_ANALYSE_CAO = f"http://{ANALYSE_CAO_HOTE}:{ANALYSE_CAO_PORT}"

entete_cle_api = APIKeyHeader(name="X-Cle-API", auto_error=False)


# ------------------------------------------------------------
# Cycle de vie
# ------------------------------------------------------------
@asynccontextmanager
async def duree_de_vie(application: FastAPI):
    journal.info("Démarrage des services FastAPI — Plateforme BEE")
    yield
    journal.info("Arrêt des services FastAPI")


# ------------------------------------------------------------
# Application
# ------------------------------------------------------------
app = FastAPI(
    title="Services Plateforme BEE",
    description="Services spécialisés — agrégateur OCR, PDF, CAO",
    version="0.1.0",
    lifespan=duree_de_vie,
    docs_url="/documentation",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ------------------------------------------------------------
# Sécurité
# ------------------------------------------------------------
async def verifier_cle_api(cle: str = Security(entete_cle_api)):
    if SECRET_API and cle != SECRET_API:
        raise HTTPException(status_code=403, detail="Clé API invalide ou manquante.")
    return cle


# ------------------------------------------------------------
# Modèles
# ------------------------------------------------------------
class ReponseEtat(BaseModel):
    statut: str
    horodatage: str
    service: str
    version: str
    services_dependants: dict


# ------------------------------------------------------------
# Routes
# ------------------------------------------------------------
@app.get("/sante", response_model=ReponseEtat, tags=["Supervision"])
async def sante():
    """Vérification de l'état du service et de ses dépendances."""
    etats = {}
    async with httpx.AsyncClient(timeout=5.0) as client:
        for nom, url in [
            ("ocr", URL_OCR),
            ("analyse-pdf", URL_ANALYSE_PDF),
            ("analyse-cao", URL_ANALYSE_CAO),
        ]:
            try:
                reponse = await client.get(f"{url}/sante")
                etats[nom] = "actif" if reponse.status_code == 200 else "dégradé"
            except Exception:
                etats[nom] = "inaccessible"

    return ReponseEtat(
        statut="actif",
        horodatage=datetime.now().isoformat(),
        service="services-bee",
        version="0.1.0",
        services_dependants=etats,
    )


@app.get("/", tags=["Général"])
async def racine():
    return {"service": "Services Plateforme BEE", "version": "0.1.0", "documentation": "/documentation"}
