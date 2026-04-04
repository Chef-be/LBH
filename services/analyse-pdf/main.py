#!/usr/bin/env python3
# ============================================================
# Service Analyse PDF — PyMuPDF + pdfplumber + FastAPI
# Plateforme LBH — Bureau d'Études Économiste
# Port : 8011
# ============================================================

import os
import io
import logging
from datetime import datetime
from contextlib import asynccontextmanager

import fitz  # PyMuPDF
import pdfplumber
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

journal = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

TAILLE_MAX = int(os.environ.get("ANALYSE_PDF_TAILLE_MAX", str(100 * 1024 * 1024)))


# ------------------------------------------------------------
# Cycle de vie
# ------------------------------------------------------------
@asynccontextmanager
async def duree_de_vie(application: FastAPI):
    journal.info("Service Analyse PDF démarré.")
    yield
    journal.info("Service Analyse PDF arrêté.")


# ------------------------------------------------------------
# Application
# ------------------------------------------------------------
app = FastAPI(
    title="Service Analyse PDF — Plateforme LBH",
    description="Extraction de texte, tableaux et métadonnées depuis des PDF",
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
class MetadonneesPDF(BaseModel):
    titre: str
    auteur: str
    sujet: str
    createur: str
    nb_pages: int
    taille_octets: int


class ResultatAnalysePDF(BaseModel):
    succes: bool
    metadonnees: MetadonneesPDF
    texte_brut: str
    nb_tableaux: int
    nb_images: int
    horodatage: str


class ReponseEtat(BaseModel):
    statut: str
    service: str
    version: str
    horodatage: str


# ------------------------------------------------------------
# Routes
# ------------------------------------------------------------
@app.get("/sante", response_model=ReponseEtat, tags=["Supervision"])
async def sante():
    return ReponseEtat(
        statut="actif",
        service="analyse-pdf-lbh",
        version="0.1.0",
        horodatage=datetime.now().isoformat(),
    )


@app.post("/pdf/analyser", response_model=ResultatAnalysePDF, tags=["Analyse PDF"])
async def analyser_pdf(
    fichier: UploadFile = File(..., description="Fichier PDF à analyser"),
):
    """Analyse un PDF : extrait texte, tableaux, images et métadonnées."""
    if fichier.content_type not in ("application/pdf", "application/octet-stream"):
        raise HTTPException(status_code=415, detail="Seuls les fichiers PDF sont acceptés.")

    contenu = await fichier.read()
    if len(contenu) > TAILLE_MAX:
        raise HTTPException(
            status_code=413,
            detail=f"Fichier trop volumineux ({len(contenu)} octets). Maximum : {TAILLE_MAX}.",
        )

    try:
        # Extraction avec PyMuPDF (métadonnées, texte, images)
        document = fitz.open(stream=contenu, filetype="pdf")
        meta = document.metadata or {}
        nb_images = sum(len(page.get_images()) for page in document)
        texte_brut = "\n\n".join(page.get_text() for page in document)
        nb_pages = len(document)
        document.close()

        # Extraction des tableaux avec pdfplumber
        nb_tableaux = 0
        with pdfplumber.open(io.BytesIO(contenu)) as pdf:
            for page in pdf.pages:
                tableaux = page.extract_tables()
                nb_tableaux += len(tableaux) if tableaux else 0

        journal.info("Analyse PDF terminée — %d pages, %d tableaux, %d images", nb_pages, nb_tableaux, nb_images)

        return ResultatAnalysePDF(
            succes=True,
            metadonnees=MetadonneesPDF(
                titre=meta.get("title", ""),
                auteur=meta.get("author", ""),
                sujet=meta.get("subject", ""),
                createur=meta.get("creator", ""),
                nb_pages=nb_pages,
                taille_octets=len(contenu),
            ),
            texte_brut=texte_brut[:50000],  # Limité à 50 000 caractères dans la réponse
            nb_tableaux=nb_tableaux,
            nb_images=nb_images,
            horodatage=datetime.now().isoformat(),
        )
    except Exception as e:
        journal.error("Erreur analyse PDF : %s", str(e))
        raise HTTPException(status_code=500, detail=f"Erreur lors de l'analyse : {str(e)}")


@app.get("/", tags=["Général"])
async def racine():
    return {"service": "Analyse PDF Plateforme LBH", "version": "0.1.0", "documentation": "/documentation"}
