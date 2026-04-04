# STRATÉGIE DE SYNCHRONISATION DU RÉPERTOIRE RESSOURCES

---

## 1. CONTEXTE ET PROBLÈME

Le répertoire `C:\ressources` est un dossier local Windows.
Il n'est **pas directement accessible** depuis le serveur distant.
Il est **impossible** de lire `C:\ressources` sans un mécanisme de transfert explicite.

---

## 2. RÉPERTOIRES UTILISÉS SUR LE SERVEUR

### Source documentaire métier actuellement utilisée

```
/var/www/vhosts/lbh-economiste.com/smb.lbh-economiste.com/data/samba/shares/admin/ressources
```

Ce partage Samba `admin/ressources` contient la bibliothèque PDF métier réelle lue par l'agent pour comprendre :

- l'étude de prix ;
- les CCTP et descriptifs ;
- les missions MOE et OPC ;
- la qualité chantier ;
- la gestion contractuelle.

### Répertoire de travail LBH

```
/var/www/vhosts/lbh-economiste.com/ressources/
├── entree/          ← Dépôt des fichiers arrivants (répertoire surveillé)
├── traitement/      ← En cours d'ingestion
├── documents/       ← Documents classés et normalisés
│   ├── voirie/
│   ├── batiment/
│   ├── economie/
│   ├── reglementaire/
│   └── securite/
├── plans/           ← Plans et dessins
├── indexation/      ← Tables d'indexation et catalogue
│   ├── catalogue.csv
│   └── correspondances.json
├── archives/        ← Archives et imports originaux
│   └── imports/
└── exports/         ← Extractions et exports
```

---

## 3. MÉTHODES DE SYNCHRONISATION DISPONIBLES

### Méthode A — SFTP / SCP (recommandée pour un premier transfert)

**Depuis le poste Windows :**

```powershell
# Option 1 : SCP (si OpenSSH installé sur Windows)
scp -r C:\ressources\* root@lbh-economiste.com:/var/www/vhosts/lbh-economiste.com/ressources/entree/

# Option 2 : avec un client SFTP graphique (FileZilla, WinSCP)
# Hôte : lbh-economiste.com
# Port : 22
# Répertoire distant : /var/www/vhosts/lbh-economiste.com/ressources/entree/
```

**Depuis le serveur (vérification) :**

```bash
ls -la /var/www/vhosts/lbh-economiste.com/ressources/entree/
```

### Méthode B — Rsync (recommandée pour les synchronisations régulières)

**Depuis le poste Windows (avec WSL ou Git Bash) :**

```bash
rsync -avz --progress \
  /mnt/c/ressources/ \
  root@lbh-economiste.com:/var/www/vhosts/lbh-economiste.com/ressources/entree/
```

**Avantages :** Ne transfère que les fichiers modifiés, vérification de l'intégrité, reprise en cas d'interruption.

### Méthode C — Script PowerShell local d'envoi automatisé

Créer un script `envoyer-ressources.ps1` sur le poste Windows :

```powershell
# Script d'envoi automatisé des ressources
# À exécuter depuis le poste Windows

$SourceLocale = "C:\ressources"
$ServeurDistant = "root@lbh-economiste.com"
$CheminDistant = "/var/www/vhosts/lbh-economiste.com/ressources/entree/"
$CleSSH = "C:\Users\[utilisateur]\.ssh\id_rsa"

# Vérification de la présence de la source
if (-not (Test-Path $SourceLocale)) {
    Write-Error "Le répertoire source n'existe pas : $SourceLocale"
    exit 1
}

# Envoi via SCP
Write-Host "Envoi des fichiers depuis $SourceLocale vers $ServeurDistant..."
scp -r -i $CleSSH "$SourceLocale\*" "${ServeurDistant}:${CheminDistant}"

if ($LASTEXITCODE -eq 0) {
    Write-Host "Transfert réussi. Relancer l'ingestion sur le serveur."
} else {
    Write-Error "Échec du transfert. Vérifier la connexion SSH."
}
```

### Méthode D — Dépôt via l'interface web (après Phase 2)

Une interface de dépôt sera disponible dans la Plateforme LBH permettant :
- L'upload direct de fichiers depuis le navigateur.
- L'upload groupé (archive ZIP décompressée automatiquement).
- La progression de l'envoi en temps réel.

---

## 4. PROCESSUS D'INGESTION APRÈS TRANSFERT

Après transfert des fichiers dans `/ressources/entree/`, lancer l'ingestion :

```bash
# Déclencher l'ingestion manuellement
docker compose exec lbh-backend python manage.py ingerer_ressources

# Ou via l'interface de supervision (après Phase 5)
```

Le processus d'ingestion effectue automatiquement :
1. Détection du type de fichier (PDF, DWG, DXF, image, tableur...)
2. Classification automatique par famille métier
3. Normalisation du nom (nommage propre et stable)
4. Enregistrement dans la table de correspondances
5. Déplacement vers le répertoire classifié
6. Indexation dans la base de données
7. Génération des métadonnées (date d'import, source, mots-clés)

---

## 5. TABLE DE CORRESPONDANCES

Fichier : `/var/www/vhosts/lbh-economiste.com/ressources/indexation/correspondances.json`

Structure :
```json
{
  "documents": [
    {
      "nom_origine": "guide chaussees 2014.pdf",
      "nom_normalise": "guide-dimensionnement-chaussees-neuves-2014.pdf",
      "chemin_normalise": "documents/voirie/guide-dimensionnement-chaussees-neuves-2014.pdf",
      "date_import": "2026-03-27",
      "type_document": "guide_technique",
      "famille_metier": "voirie",
      "mots_cles": ["chaussée", "dimensionnement", "structure", "trafic"],
      "niveau_confiance": 0.92,
      "observations": "Classé automatiquement — à vérifier"
    }
  ]
}
```

---

## 6. RÈGLES DE NOMMAGE NORMALISÉ

- Minuscules uniquement.
- Tirets à la place des espaces.
- Pas d'accents dans le nom de fichier (mais accents conservés dans les métadonnées).
- Extension conservée en minuscules.
- Année ajoutée si identifiable depuis le document.
- Préfixe de famille si ambigu.

**Exemples :**

| Nom d'origine | Nom normalisé |
|---|---|
| `Guide chaussées neuves.pdf` | `guide-dimensionnement-chaussees-neuves.pdf` |
| `Manuel étude de prix BTP.pdf` | `manuel-etude-de-prix-btp.pdf` |
| `DTU 13.1 fondations superficielles.pdf` | `dtu-13-1-fondations-superficielles.pdf` |
| `Catalogue VRD 2024 (version 3).pdf` | `catalogue-vrd-2024-v3.pdf` |
| `PLAN RDC batiment A.dxf` | `plan-rdc-batiment-a.dxf` |

---

## 7. COMMANDES UTILES SUR LE SERVEUR

```bash
# Vérifier les fichiers en attente d'ingestion
ls -la /var/www/vhosts/lbh-economiste.com/ressources/entree/

# Lancer l'ingestion manuellement
docker compose -f /var/www/vhosts/lbh-economiste.com/httpdocs/compose.yaml \
  exec lbh-backend python manage.py ingerer_ressources

# Voir le catalogue après ingestion
cat /var/www/vhosts/lbh-economiste.com/ressources/indexation/catalogue.csv | column -t -s ","

# Vérifier les journaux d'ingestion
docker compose -f /var/www/vhosts/lbh-economiste.com/httpdocs/compose.yaml \
  logs lbh-backend | grep ingestion
```
