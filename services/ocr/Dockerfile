# ============================================================
# Dockerfile — Service OCR
# Plateforme LBH — Tesseract 5 + Python + FastAPI
# ============================================================

FROM python:3.11-slim-bookworm

LABEL description="Service OCR — Tesseract 5 + EasyOCR"

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Installation de Tesseract 5 et données de langue
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-fra \
    tesseract-ocr-eng \
    # Traitement d'images
    libgl1-mesa-glx \
    libglib2.0-0 \
    poppler-utils \
    # Utilitaires
    curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Dépendances Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8010

HEALTHCHECK --interval=30s --timeout=10s --start-period=45s --retries=3 \
    CMD curl -f http://localhost:8010/sante || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8010", "--log-level", "info"]
