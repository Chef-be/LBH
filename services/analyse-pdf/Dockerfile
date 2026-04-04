# ============================================================
# Dockerfile — Service Analyse PDF
# Plateforme BEE — PyMuPDF + pdfplumber + FastAPI
# ============================================================

FROM python:3.11-slim-bookworm

LABEL description="Service d'analyse PDF métier"

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    poppler-utils \
    curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8011

HEALTHCHECK --interval=30s --timeout=10s --start-period=45s --retries=3 \
    CMD curl -f http://localhost:8011/sante || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8011", "--log-level", "info"]
