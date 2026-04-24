# ============================================================
# Dockerfile — Cœur applicatif Django
# Plateforme LBH — Bureau d'Études Économiste
# ============================================================

FROM python:3.11-slim-bookworm AS base

# Métadonnées
LABEL maintainer="Plateforme LBH"
LABEL description="Cœur applicatif Django — Bureau d'Études Économiste"

# Variables d'environnement Python
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONFAULTHANDLER=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Répertoire de travail
WORKDIR /app

# Installation des dépendances système
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Compilation Python et C
    build-essential \
    autoconf automake libtool gperf \
    wget \
    # PostgreSQL
    libpq-dev \
    # Traitement de fichiers
    libffi-dev \
    libxml2-dev \
    libxslt-dev \
    libcairo2 \
    libpango-1.0-0 \
    libgdk-pixbuf-2.0-0 \
    shared-mime-info \
    # LibreOffice pour la conversion DOCX → PDF
    libreoffice \
    libreoffice-writer \
    # GDAL / GEOS / PROJ pour Django GeoDjango + PostGIS
    libgdal-dev \
    libgeos-dev \
    libproj-dev \
    # Outils réseau
    curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Compilation LibreDWG — conversion DWG binaire → DXF (outil dwg2dxf)
# libredwg n'est pas dans Debian bookworm ; on compile depuis les sources GNU
RUN wget -q https://ftp.gnu.org/gnu/libredwg/libredwg-0.12.5.tar.gz \
    && tar -xf libredwg-0.12.5.tar.gz \
    && cd libredwg-0.12.5 \
    && ./configure --disable-bindings --disable-python \
    && make -j"$(nproc)" \
    && make install \
    && ldconfig \
    && cd .. \
    && rm -rf libredwg-0.12.5 libredwg-0.12.5.tar.gz

# Installation des dépendances Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copie du code applicatif
COPY . .

# Création de l'utilisateur non-root pour la production
RUN groupadd -r lbh && useradd -r -g lbh lbh \
    && mkdir -p /app/statiques /app/medias /var/log/lbh/backend \
    && chown -R lbh:lbh /app /var/log/lbh

# Port exposé (interne uniquement — via lbh-nginx)
EXPOSE 8000

# Script de démarrage
COPY scripts/demarrage.sh /usr/local/bin/demarrage.sh
RUN chmod +x /usr/local/bin/demarrage.sh

# Vérification de santé
HEALTHCHECK --interval=30s --timeout=15s --start-period=90s --retries=5 \
    CMD curl -f http://localhost:8000/api/sante/ || exit 1

# En production, passer à l'utilisateur lbh
# USER lbh

CMD ["/usr/local/bin/demarrage.sh"]
