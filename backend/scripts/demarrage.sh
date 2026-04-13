#!/bin/bash
# ============================================================
# Script de démarrage — Cœur applicatif Django
# Plateforme LBH
# ============================================================

set -e

NOM_PLATEFORME_AFFICHAGE="${NOM_PLATEFORME:-LBH Economiste}"

echo "=============================================="
echo " ${NOM_PLATEFORME_AFFICHAGE} — Démarrage du cœur applicatif"
echo "=============================================="

# Attendre que PostgreSQL soit disponible
echo "[1/5] Attente de la base de données..."
until python -c "
import os, sys, psycopg2
try:
    prefixe = os.environ.get('PREFIXE_CONTENEURS', 'lbh')
    conn = psycopg2.connect(
        host=os.environ.get('BDD_HOTE') or f'{prefixe}-postgresql',
        port=int(os.environ.get('BDD_PORT', '5432')),
        dbname=os.environ.get('BDD_NOM') or ('plateforme_' + prefixe.replace('-', '_')),
        user=os.environ.get('BDD_UTILISATEUR') or (prefixe.replace('-', '_') + '_appli'),
        password=os.environ.get('BDD_MOT_DE_PASSE', ''),
        connect_timeout=5
    )
    conn.close()
    print('Base de données disponible.')
except Exception as e:
    print(f'Base de données non disponible : {e}')
    sys.exit(1)
"; do
    echo "  Base de données non disponible — nouvelle tentative dans 3 secondes..."
    sleep 3
done

# Attendre que Redis soit disponible
echo "[2/5] Attente du service Redis..."
until python -c "
import os, sys, redis
try:
    prefixe = os.environ.get('PREFIXE_CONTENEURS', 'lbh')
    r = redis.Redis(
        host=os.environ.get('REDIS_HOTE') or f'{prefixe}-redis',
        port=int(os.environ.get('REDIS_PORT', '6379')),
        socket_connect_timeout=5
    )
    r.ping()
    print('Redis disponible.')
except Exception as e:
    print(f'Redis non disponible : {e}')
    sys.exit(1)
"; do
    echo "  Redis non disponible — nouvelle tentative dans 3 secondes..."
    sleep 3
done

# Appliquer les migrations
echo "[3/5] Application des migrations de base de données..."
python manage.py migrate --noinput

# Collecter les fichiers statiques
echo "[4/5] Collecte des fichiers statiques..."
python manage.py collectstatic --noinput --clear

# Initialiser les données de base (si première installation)
echo "[5/5] Vérification des données initiales..."
python manage.py initialiser_donnees_base || echo "Données de base déjà initialisées."

echo "----------------------------------------------"
echo " Démarrage du serveur Gunicorn..."
echo "----------------------------------------------"

# Démarrer Gunicorn
exec gunicorn noyau.wsgi:application \
    --bind 0.0.0.0:8000 \
    --workers 4 \
    --worker-class gthread \
    --threads 2 \
    --worker-tmp-dir /dev/shm \
    --timeout 300 \
    --graceful-timeout 30 \
    --max-requests 1000 \
    --max-requests-jitter 100 \
    --log-level info \
    --access-logfile /var/log/app/backend/acces.log \
    --error-logfile /var/log/app/backend/erreurs.log
