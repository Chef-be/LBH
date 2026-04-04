#!/usr/bin/env python3
# ============================================================
# Service OCR — Tesseract 5 + FastAPI
# Plateforme BEE — Bureau d'Études Économiste
# Port : 8010
# ============================================================

import os
import io
import logging
from datetime import datetime
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image
import pytesseract
import fitz  # PyMuPDF

journal = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

# ------------------------------------------------------------
# Configuration
# ------------------------------------------------------------
LANGUES_OCR = os.environ.get("OCR_LANGUES", "fra+eng")
SEUIL_CONFIANCE = int(os.environ.get("OCR_SEUIL_CONFIANCE", "60"))
TAILLE_MAX = int(os.environ.get("OCR_TAILLE_MAX_FICHIER", str(50 * 1024 * 1024)))
DPI = int(os.environ.get("OCR_DPI_OPTIMAL", "300"))

MIMETYPES_ACCEPTES = {
    "image/png", "image/jpeg", "image/tiff", "image/bmp", "image/webp",
    "application/pdf",
}


# ------------------------------------------------------------
# Cycle de vie
# ------------------------------------------------------------
@asynccontextmanager
async def duree_de_vie(application: FastAPI):
    journal.info("Service OCR démarré — langues : %s", LANGUES_OCR)
    yield
    journal.info("Service OCR arrêté.")


# ------------------------------------------------------------
# Application
# ------------------------------------------------------------
app = FastAPI(
    title="Service OCR — Plateforme BEE",
    description="Extraction de texte par OCR (Tesseract 5) depuis images et PDF",
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
class ResultatOCR(BaseModel):
    succes: bool
    texte: str
    confiance: float
    pages: int
    langue: str
    horodatage: str


class ReponseEtat(BaseModel):
    statut: str
    service: str
    version: str
    langues: str
    horodatage: str


# ------------------------------------------------------------
# Utilitaires
# ------------------------------------------------------------
def ocr_image(image: Image.Image) -> tuple[str, float]:
    """Extrait le texte d'une image PIL et retourne (texte, confiance)."""
    config = f"--dpi {DPI} --oem 3 --psm 3"
    donnees = pytesseract.image_to_data(
        image, lang=LANGUES_OCR, config=config, output_type=pytesseract.Output.DICT
    )
    mots = [m for m, c in zip(donnees["text"], donnees["conf"]) if int(c) >= 0 and m.strip()]
    confidences = [int(c) for c in donnees["conf"] if int(c) >= 0]
    texte = " ".join(mots)
    confiance = sum(confidences) / len(confidences) if confidences else 0.0
    return texte, confiance


def ocr_pdf(contenu: bytes) -> tuple[str, float, int]:
    """Extrait le texte d'un PDF (page par page) et retourne (texte, confiance, nb_pages)."""
    document = fitz.open(stream=contenu, filetype="pdf")
    textes = []
    confidences_totales = []
    for page in document:
        pixmap = page.get_pixmap(dpi=DPI)
        img = Image.frombytes("RGB", [pixmap.width, pixmap.height], pixmap.samples)
        texte_page, conf_page = ocr_image(img)
        textes.append(texte_page)
        confidences_totales.append(conf_page)
    nb_pages = len(document)
    document.close()
    texte_final = "\n\n".join(textes)
    confiance_moy = sum(confidences_totales) / len(confidences_totales) if confidences_totales else 0.0
    return texte_final, confiance_moy, nb_pages


# ------------------------------------------------------------
# Routes
# ------------------------------------------------------------
@app.get("/sante", response_model=ReponseEtat, tags=["Supervision"])
async def sante():
    return ReponseEtat(
        statut="actif",
        service="ocr-bee",
        version="0.1.0",
        langues=LANGUES_OCR,
        horodatage=datetime.now().isoformat(),
    )


@app.post("/ocr/extraire", response_model=ResultatOCR, tags=["OCR"])
async def extraire_texte(
    fichier: UploadFile = File(..., description="Fichier image ou PDF à analyser"),
    langue: str = Form(default="", description="Langue Tesseract (ex: fra+eng). Vide = config serveur."),
):
    """Extrait le texte d'un fichier image ou PDF par OCR."""
    if fichier.content_type not in MIMETYPES_ACCEPTES:
        raise HTTPException(
            status_code=415,
            detail=f"Type de fichier non supporté : {fichier.content_type}. Acceptés : {', '.join(MIMETYPES_ACCEPTES)}",
        )

    contenu = await fichier.read()
    if len(contenu) > TAILLE_MAX:
        raise HTTPException(
            status_code=413,
            detail=f"Fichier trop volumineux ({len(contenu)} octets). Maximum : {TAILLE_MAX} octets.",
        )

    langues_utilisees = langue if langue else LANGUES_OCR

    try:
        if fichier.content_type == "application/pdf":
            texte, confiance, nb_pages = ocr_pdf(contenu)
        else:
            image = Image.open(io.BytesIO(contenu))
            texte, confiance = ocr_image(image)
            nb_pages = 1

        journal.info("OCR terminé — %d pages, confiance %.1f%%", nb_pages, confiance)

        return ResultatOCR(
            succes=True,
            texte=texte,
            confiance=round(confiance, 2),
            pages=nb_pages,
            langue=langues_utilisees,
            horodatage=datetime.now().isoformat(),
        )
    except Exception as e:
        journal.error("Erreur OCR : %s", str(e))
        raise HTTPException(status_code=500, detail=f"Erreur lors de l'extraction OCR : {str(e)}")


@app.get("/", tags=["Général"])
async def racine():
    return {"service": "OCR Plateforme BEE", "version": "0.1.0", "documentation": "/documentation"}
