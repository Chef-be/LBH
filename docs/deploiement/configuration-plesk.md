# CONFIGURATION PLESK — Plateforme BEE

---

## 1. ARCHITECTURE DE DÉPLOIEMENT

```
Internet (80/443)
      │
   [Plesk Nginx]  ←── Certificat SSL géré par Plesk (Let's Encrypt)
      │
      │ Proxy reverse vers 127.0.0.1:3082
      │
   [bee-nginx]   ←── Conteneur Docker interne
      │
      ├── /api/  →  [bee-backend:8000]   (Django)
      ├── /services/ → [bee-services:8001] (FastAPI)
      └── /      →  [bee-frontend:3000]  (Next.js)
```

---

## 2. CONFIGURATION DU PROXY INVERSE PLESK

### Étape 1 — Créer ou utiliser un domaine / sous-domaine

Option A : Sous-domaine dédié (recommandé)
- Créer `bee.lbh-economiste.com` dans Plesk
- Ou utiliser le domaine principal `lbh-economiste.com`

### Étape 2 — Configurer le proxy inverse dans Plesk

Dans Plesk :
1. Domaines → lbh-economiste.com → Hébergement web → Paramètres Apache & Nginx
2. Dans la section "Configuration de proxy Nginx supplémentaire", ajouter :

```nginx
# Proxy vers la Plateforme BEE
location / {
    proxy_pass http://127.0.0.1:3082;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 300s;
    proxy_connect_timeout 60s;
    proxy_send_timeout 300s;
    client_max_body_size 100m;
}
```

3. Cliquer sur "Appliquer"

### Étape 3 — Activer le certificat SSL

Dans Plesk :
1. Domaines → bee.lbh-economiste.com → SSL/TLS
2. Sélectionner "Let's Encrypt"
3. Activer "Redirection HTTP → HTTPS"

---

## 3. CONFIGURATION DOCKER DANS PLESK

Si Docker est géré via l'interface Plesk :

1. Outils & Paramètres → Docker
2. Le compose.yaml se gère via SSH directement :

```bash
cd /var/www/vhosts/lbh-economiste.com/httpdocs
docker compose up -d
```

---

## 4. VÉRIFICATION DU DÉPLOIEMENT

```bash
# Vérifier que tous les conteneurs sont démarrés
docker compose ps

# Vérifier que le port 3082 est en écoute
ss -tlnp | grep 3082

# Tester la réponse du proxy
curl -s http://127.0.0.1:3082/sante-proxy

# Tester l'API Django
curl -s http://127.0.0.1:3082/api/sante/

# Vérifier les journaux
docker compose logs --tail=20 bee-nginx
docker compose logs --tail=20 bee-backend
docker compose logs --tail=20 bee-frontend
```

---

## 5. DÉMARRAGE AU REDÉMARRAGE DU SERVEUR

Docker Compose démarrera automatiquement les conteneurs au redémarrage grâce à `restart: unless-stopped` dans chaque service.

Pour vérifier :
```bash
systemctl is-enabled docker
# Doit retourner : enabled
```

---

## 6. PORTS À NE PAS UTILISER (CONFLITS)

| Port | Service existant |
|---|---|
| 3080, 3081 | CSA (dev et dev-1) |
| 5432 | PostgreSQL public (PostGIS) |
| 5433 | PostgreSQL local Plesk |
| 6379 | Redis (lbh-redis) |
| 6800, 6888 | Aria2 |
| 8080 | VPN admin |
| 8082 | Nextcloud |
| 8083 | Keycloak |
| 8084 | Collabora |
| 8085 | Ariang |

**Ports réservés Plateforme BEE :**
- 3082 : proxy Nginx BEE
- 5434 : PostgreSQL BEE (accès local uniquement)
- 9100 : MinIO API BEE
- 9101 : MinIO Console BEE

---

## 7. SAUVEGARDE AVANT DÉPLOIEMENT

```bash
# Sauvegarder la base de données
docker compose exec bee-postgresql pg_dump \
    -U ${BDD_UTILISATEUR} ${BDD_NOM} \
    > /tmp/bee-sauvegarde-$(date +%Y%m%d-%H%M%S).sql

# Compresser
gzip /tmp/bee-sauvegarde-*.sql

# Déplacer vers un répertoire sécurisé
mv /tmp/bee-sauvegarde-*.sql.gz \
   /var/www/vhosts/lbh-economiste.com/httpdocs/volumes/sauvegardes/
```
