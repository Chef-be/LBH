#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# test-routes.sh — Test complet des routes API et pages frontend
# Usage : bash scripts/test-routes.sh
# ─────────────────────────────────────────────────────────────────────────────

BASE="http://127.0.0.1:3082"
PASS=0; FAIL=0; WARN=0
ERREURS=()

# ── Auth ──────────────────────────────────────────────────────────────────────
echo "🔐 Authentification..."
RESP=$(curl -s -X POST "$BASE/api/auth/connexion/" \
  -H "Content-Type: application/json" \
  -d '{"courriel":"admin.test.e2e@lbh-economiste.com","mot_de_passe":"TestLBH2026!"}')
TOKEN=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['jetons']['acces'])" 2>/dev/null)
if [ -z "$TOKEN" ]; then
  echo "❌ ECHEC authentification — arrêt du test"
  exit 1
fi
echo "✅ Token obtenu (${#TOKEN} chars)"
AUTH="Authorization: Bearer $TOKEN"

# ── Fonction de test ──────────────────────────────────────────────────────────
test_get() {
  local label="$1"
  local url="$2"
  local expected="${3:-200}"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" -H "$AUTH" "$url")
  if [ "$code" = "$expected" ] || [ "$code" = "200" ] || [ "$code" = "201" ]; then
    echo "  ✅ [$code] $label"
    PASS=$((PASS+1))
  elif [ "$code" = "404" ] || [ "$code" = "500" ] || [ "$code" = "502" ] || [ "$code" = "503" ]; then
    echo "  ❌ [$code] $label — $url"
    FAIL=$((FAIL+1))
    ERREURS+=("[$code] $label — $url")
  else
    echo "  ⚠️  [$code] $label"
    WARN=$((WARN+1))
    ERREURS+=("[WARN $code] $label — $url")
  fi
}

# Récupérer un projet, un document, une étude pour tests avec IDs réels
echo ""
echo "📋 Récupération des IDs de test..."
PROJET_ID=$(curl -s -H "$AUTH" "$BASE/api/projets/?limite=1" | python3 -c "import sys,json; r=json.load(sys.stdin); d=r.get('results',r) if isinstance(r,dict) else r; print(d[0]['id'] if d else '')" 2>/dev/null)
ETUDE_ID=$(curl -s -H "$AUTH" "$BASE/api/economie/etudes/?limite=1" | python3 -c "import sys,json; r=json.load(sys.stdin); d=r.get('results',r) if isinstance(r,dict) else r; print(d[0]['id'] if d else '')" 2>/dev/null)
DOC_ID=$(curl -s -H "$AUTH" "$BASE/api/documents/?limite=1" | python3 -c "import sys,json; r=json.load(sys.stdin); d=r.get('results',r) if isinstance(r,dict) else r; print(d[0]['id'] if d else '')" 2>/dev/null)
PIECE_ID=$(curl -s -H "$AUTH" "$BASE/api/pieces-ecrites/?limite=1" | python3 -c "import sys,json; r=json.load(sys.stdin); d=r.get('results',r) if isinstance(r,dict) else r; print(d[0]['id'] if d else '')" 2>/dev/null)
AO_ID=$(curl -s -H "$AUTH" "$BASE/api/appels-offres/?limite=1" | python3 -c "import sys,json; r=json.load(sys.stdin); d=r.get('results',r) if isinstance(r,dict) else r; print(d[0]['id'] if d else '')" 2>/dev/null)
METRE_ID=$(curl -s -H "$AUTH" "$BASE/api/metres/?limite=1" | python3 -c "import sys,json; r=json.load(sys.stdin); d=r.get('results',r) if isinstance(r,dict) else r; print(d[0]['id'] if d else '')" 2>/dev/null)
DEVIS_ID=$(curl -s -H "$AUTH" "$BASE/api/societe/devis/?limite=1" | python3 -c "import sys,json; r=json.load(sys.stdin); d=r.get('results',r) if isinstance(r,dict) else r; print(d[0]['id'] if d else '')" 2>/dev/null)
FACTURE_ID=$(curl -s -H "$AUTH" "$BASE/api/societe/factures/?limite=1" | python3 -c "import sys,json; r=json.load(sys.stdin); d=r.get('results',r) if isinstance(r,dict) else r; print(d[0]['id'] if d else '')" 2>/dev/null)

echo "  Projet : ${PROJET_ID:-AUCUN}"
echo "  Étude  : ${ETUDE_ID:-AUCUN}"
echo "  Doc    : ${DOC_ID:-AUCUN}"
echo "  Pièce  : ${PIECE_ID:-AUCUN}"
echo "  AO     : ${AO_ID:-AUCUN}"
echo "  Mètre  : ${METRE_ID:-AUCUN}"
echo "  Devis  : ${DEVIS_ID:-AUCUN}"
echo "  Facture: ${FACTURE_ID:-AUCUN}"

# ─────────────────────────────────────────────────────────────────────────────
# 1. AUTH & CONFIG
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "━━━ AUTH & CONFIG ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_get "sante API"                    "$BASE/api/sante/"
test_get "config"                       "$BASE/api/config/"
test_get "profil utilisateur"           "$BASE/api/auth/moi/"
test_get "organisations"                "$BASE/api/organisations/"
test_get "parametres"                   "$BASE/api/parametres/"

# ─────────────────────────────────────────────────────────────────────────────
# 2. PROJETS
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "━━━ PROJETS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_get "liste projets"                "$BASE/api/projets/"
test_get "statistiques projets"         "$BASE/api/projets/statistiques/"
test_get "parcours projet"              "$BASE/api/projets/parcours/"
test_get "orientation projet"           "$BASE/api/projets/orientation/"
test_get "indices prix références"      "$BASE/api/projets/indices-prix/references/?limite=5"
test_get "missions-livrables"           "$BASE/api/projets/missions-livrables/"
test_get "modeles-documents"            "$BASE/api/projets/modeles-documents/"
test_get "ressources-documentaires"     "$BASE/api/projets/ressources-documentaires/"

if [ -n "$PROJET_ID" ]; then
  test_get "detail projet"              "$BASE/api/projets/$PROJET_ID/"
  test_get "synthèse projet"            "$BASE/api/projets/$PROJET_ID/synthese/"
  test_get "statuts livrables"          "$BASE/api/projets/$PROJET_ID/statuts-livrables/"
  test_get "lots projet"                "$BASE/api/projets/$PROJET_ID/lots/"
  test_get "intervenants projet"        "$BASE/api/projets/$PROJET_ID/intervenants/"
  test_get "qualification documentaire" "$BASE/api/projets/$PROJET_ID/qualification-documentaire/"
fi

# ─────────────────────────────────────────────────────────────────────────────
# 3. ÉCONOMIE
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "━━━ ÉCONOMIE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_get "liste études économiques"     "$BASE/api/economie/"
test_get "modèles phases études (admin)" "$BASE/api/economie/modeles-phases-etudes/"
test_get "études de prix"               "$BASE/api/economie/etudes-de-prix/"

if [ -n "$ETUDE_ID" ]; then
  test_get "detail étude"               "$BASE/api/economie/$ETUDE_ID/"
  test_get "phases étude"               "$BASE/api/economie/$ETUDE_ID/phases/"
  test_get "lignes étude"               "$BASE/api/economie/$ETUDE_ID/lignes/"
fi

# ─────────────────────────────────────────────────────────────────────────────
# 4. DOCUMENTS / GED
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "━━━ DOCUMENTS / GED ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_get "liste documents"              "$BASE/api/documents/"
test_get "dossiers GED"                 "$BASE/api/documents/dossiers/"

if [ -n "$DOC_ID" ]; then
  test_get "detail document"            "$BASE/api/documents/$DOC_ID/"
fi

# ─────────────────────────────────────────────────────────────────────────────
# 5. PIÈCES ÉCRITES
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "━━━ PIÈCES ÉCRITES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_get "liste pièces écrites"         "$BASE/api/pieces-ecrites/"

if [ -n "$PIECE_ID" ]; then
  test_get "detail pièce"               "$BASE/api/pieces-ecrites/$PIECE_ID/"
  test_get "articles pièce"             "$BASE/api/pieces-ecrites/$PIECE_ID/articles/"
  test_get "lignes DPGF pièce"          "$BASE/api/pieces-ecrites/$PIECE_ID/lignes-dpgf/"
  test_get "synthèse DPGF"              "$BASE/api/pieces-ecrites/$PIECE_ID/synthese-dpgf/"
fi

# ─────────────────────────────────────────────────────────────────────────────
# 6. APPELS D'OFFRES
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "━━━ APPELS D'OFFRES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_get "liste AO"                     "$BASE/api/appels-offres/"

if [ -n "$AO_ID" ]; then
  test_get "detail AO"                  "$BASE/api/appels-offres/$AO_ID/"
fi

# ─────────────────────────────────────────────────────────────────────────────
# 7. MÉTRÉS
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "━━━ MÉTRÉS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_get "liste métrés"                 "$BASE/api/metres/"

if [ -n "$METRE_ID" ]; then
  test_get "detail mètre"               "$BASE/api/metres/$METRE_ID/"
  test_get "lignes mètre"               "$BASE/api/metres/$METRE_ID/lignes/"
fi

# ─────────────────────────────────────────────────────────────────────────────
# 8. BIBLIOTHÈQUE
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "━━━ BIBLIOTHÈQUE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_get "bibliothèque prix"            "$BASE/api/bibliotheque/"
test_get "bibliothèque recherche"       "$BASE/api/bibliotheque/?recherche=beton"

# ─────────────────────────────────────────────────────────────────────────────
# 9. SOCIÉTÉ (devis, factures)
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "━━━ SOCIÉTÉ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_get "liste devis"                  "$BASE/api/societe/devis/"
test_get "liste factures"               "$BASE/api/societe/factures/"

if [ -n "$DEVIS_ID" ]; then
  test_get "detail devis"               "$BASE/api/societe/devis/$DEVIS_ID/"
fi
if [ -n "$FACTURE_ID" ]; then
  test_get "detail facture"             "$BASE/api/societe/factures/$FACTURE_ID/"
fi

# ─────────────────────────────────────────────────────────────────────────────
# 10. RESSOURCES
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "━━━ RESSOURCES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_get "indices ressources"           "$BASE/api/ressources/indices/"
test_get "prix marché ressources"       "$BASE/api/ressources/prix-marche/"
test_get "estimations ressources"       "$BASE/api/ressources/estimations/"

# ─────────────────────────────────────────────────────────────────────────────
# 11. VOIRIE / BÂTIMENT / EXÉCUTION / RENTABILITÉ
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "━━━ MODULES SPÉCIALISÉS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_get "voirie études"                "$BASE/api/voirie/"
test_get "bâtiment programmes"          "$BASE/api/batiment/"
test_get "exécution suivis"             "$BASE/api/execution/"
test_get "rentabilité (avec projet)"    "$BASE/api/rentabilite/projet/$PROJET_ID/" "200"

# ─────────────────────────────────────────────────────────────────────────────
# 12. PAGES FRONTEND (vérification HTTP 200)
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "━━━ PAGES FRONTEND ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

test_frontend() {
  local label="$1"
  local url="$2"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" "$url")
  if [ "$code" = "200" ]; then
    echo "  ✅ [$code] $label"
    PASS=$((PASS+1))
  elif [ "$code" = "307" ] || [ "$code" = "302" ] || [ "$code" = "308" ]; then
    echo "  ↪️  [$code] $label (redirect)"
    PASS=$((PASS+1))
  elif [ "$code" = "404" ] || [ "$code" = "500" ] || [ "$code" = "502" ]; then
    echo "  ❌ [$code] $label — $url"
    FAIL=$((FAIL+1))
    ERREURS+=("[$code] FRONTEND $label — $url")
  else
    echo "  ⚠️  [$code] $label"
    WARN=$((WARN+1))
  fi
}

test_frontend "page accueil publique"   "$BASE/"
test_frontend "page connexion"          "$BASE/connexion"
test_frontend "tableau de bord"         "$BASE/projets"
test_frontend "liste projets"           "$BASE/projets"
test_frontend "nouveau projet"          "$BASE/projets/nouveau"
test_frontend "administration"          "$BASE/administration"
test_frontend "admin modèles docs"      "$BASE/administration/modeles-documents"
test_frontend "admin phases études"     "$BASE/administration/phases-etudes"

if [ -n "$PROJET_ID" ]; then
  test_frontend "fiche projet"          "$BASE/projets/$PROJET_ID"
  test_frontend "économie projet"       "$BASE/projets/$PROJET_ID/economie"
  test_frontend "planning projet"       "$BASE/projets/$PROJET_ID/planning"
  test_frontend "documents projet"      "$BASE/projets/$PROJET_ID/documents"
  test_frontend "pièces écrites"        "$BASE/projets/$PROJET_ID/pieces-ecrites"
  test_frontend "appels d'offres"       "$BASE/projets/$PROJET_ID/appels-offres"
  test_frontend "exécution projet"      "$BASE/projets/$PROJET_ID/execution"
  test_frontend "métrés projet"         "$BASE/projets/$PROJET_ID/metres"
  test_frontend "rentabilité projet"    "$BASE/projets/$PROJET_ID/rentabilite"
  test_frontend "modifier projet"       "$BASE/projets/$PROJET_ID/modifier"
fi

# ─────────────────────────────────────────────────────────────────────────────
# RÉSUMÉ
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 RÉSULTATS : ✅ $PASS OK  |  ❌ $FAIL ERREURS  |  ⚠️  $WARN AVERTISSEMENTS"
echo ""

if [ ${#ERREURS[@]} -gt 0 ]; then
  echo "🔴 LISTE DES PROBLÈMES :"
  for e in "${ERREURS[@]}"; do
    echo "   $e"
  done
else
  echo "🟢 Aucune erreur critique détectée."
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
