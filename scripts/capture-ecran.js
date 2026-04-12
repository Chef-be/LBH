#!/usr/bin/env node
/**
 * Outil de capture d'écran — Plateforme LBH
 *
 * Usage :
 *   node scripts/capture-ecran.js avant  "nom-fonctionnalite" "http://127.0.0.1:3082/page"
 *   node scripts/capture-ecran.js apres  "nom-fonctionnalite" "http://127.0.0.1:3082/page"
 *   node scripts/capture-ecran.js comparer "nom-fonctionnalite"
 *   node scripts/capture-ecran.js serie   "nom-fonctionnalite" "url1,url2,url3"
 *
 * Les captures sont enregistrées dans scripts/captures/
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const REPERTOIRE_CAPTURES = path.join(__dirname, 'captures');
const DELAI_CHARGEMENT = 2000;   // ms d'attente après chargement
const LARGEUR_VIEWPORT = 1440;
const HAUTEUR_VIEWPORT = 900;

// Créer le répertoire de captures s'il n'existe pas
if (!fs.existsSync(REPERTOIRE_CAPTURES)) {
  fs.mkdirSync(REPERTOIRE_CAPTURES, { recursive: true });
}

function horodatage() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function nomFichier(phase, nom, suffixe = '') {
  const base = nom.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  const ts = horodatage();
  return path.join(REPERTOIRE_CAPTURES, `${phase}_${base}${suffixe ? '_' + suffixe : ''}_${ts}.png`);
}

function nomFichierDernier(phase, nom, suffixe = '') {
  const base = nom.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  return path.join(REPERTOIRE_CAPTURES, `${phase}_${base}${suffixe ? '_' + suffixe : ''}_dernier.png`);
}

async function capturer(phase, nom, url, options = {}) {
  console.log(`\n📸 Capture [${phase.toUpperCase()}] — ${nom}`);
  console.log(`   URL : ${url}`);

  const navigateur = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const contexte = await navigateur.newContext({
      viewport: { width: LARGEUR_VIEWPORT, height: HAUTEUR_VIEWPORT },
      locale: 'fr-FR',
      timezoneId: 'Europe/Paris',
      ...options.contexte,
    });

    const page = await contexte.newPage();

    // Authentification si cookie fourni
    if (options.cookie) {
      await contexte.addCookies([options.cookie]);
    }

    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(DELAI_CHARGEMENT);

    // Capture pleine page + viewport
    const cheminPleine = nomFichier(phase, nom, 'pleine');
    const cheminDernierPleine = nomFichierDernier(phase, nom, 'pleine');

    await page.screenshot({ path: cheminPleine, fullPage: true });
    fs.copyFileSync(cheminPleine, cheminDernierPleine);

    const cheminVue = nomFichier(phase, nom, 'vue');
    const cheminDernierVue = nomFichierDernier(phase, nom, 'vue');

    await page.screenshot({ path: cheminVue, fullPage: false });
    fs.copyFileSync(cheminVue, cheminDernierVue);

    console.log(`   ✓ Pleine page  : ${path.basename(cheminPleine)}`);
    console.log(`   ✓ Viewport     : ${path.basename(cheminVue)}`);
    console.log(`   ✓ Dernière     : ${path.basename(cheminDernierPleine)}`);

    await contexte.close();
  } finally {
    await navigateur.close();
  }
}

async function capturerSerie(phase, nom, urls) {
  const liste = urls.split(',').map(u => u.trim()).filter(Boolean);
  console.log(`\n📸 Série [${phase.toUpperCase()}] — ${nom} (${liste.length} page(s))`);

  for (let i = 0; i < liste.length; i++) {
    const suffixe = `page${i + 1}`;
    await capturer(phase, nom, liste[i], {});
  }
}

function comparer(nom) {
  console.log(`\n🔍 Comparaison — ${nom}`);
  const base = nom.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();

  const avant = path.join(REPERTOIRE_CAPTURES, `avant_${base}_pleine_dernier.png`);
  const apres = path.join(REPERTOIRE_CAPTURES, `apres_${base}_pleine_dernier.png`);

  if (!fs.existsSync(avant)) {
    console.log(`   ✗ Capture AVANT introuvable : ${path.basename(avant)}`);
    console.log(`     → Exécuter d'abord : node scripts/capture-ecran.js avant "${nom}" "URL"`);
    return;
  }

  if (!fs.existsSync(apres)) {
    console.log(`   ✗ Capture APRÈS introuvable : ${path.basename(apres)}`);
    console.log(`     → Exécuter d'abord : node scripts/capture-ecran.js apres "${nom}" "URL"`);
    return;
  }

  const tailleAvant = fs.statSync(avant).size;
  const tailleApres = fs.statSync(apres).size;
  const delta = tailleApres - tailleAvant;

  console.log(`   AVANT  : ${path.basename(avant)} (${(tailleAvant / 1024).toFixed(1)} Ko)`);
  console.log(`   APRÈS  : ${path.basename(apres)} (${(tailleApres / 1024).toFixed(1)} Ko)`);
  console.log(`   Delta  : ${delta >= 0 ? '+' : ''}${(delta / 1024).toFixed(1)} Ko`);
  console.log(`\n   → Vérifier visuellement les deux fichiers dans : scripts/captures/`);
}

function listerCaptures() {
  console.log(`\n📂 Captures disponibles dans : ${REPERTOIRE_CAPTURES}`);
  const fichiers = fs.readdirSync(REPERTOIRE_CAPTURES)
    .filter(f => f.endsWith('.png'))
    .sort();

  if (fichiers.length === 0) {
    console.log('   (aucune capture)');
    return;
  }

  fichiers.forEach(f => {
    const stat = fs.statSync(path.join(REPERTOIRE_CAPTURES, f));
    console.log(`   ${f} (${(stat.size / 1024).toFixed(1)} Ko)`);
  });
}

// --- Point d'entrée ---

const [,, commande, ...args] = process.argv;

(async () => {
  try {
    switch (commande) {
      case 'avant':
      case 'apres': {
        const [nom, url] = args;
        if (!nom || !url) {
          console.error(`Usage : node scripts/capture-ecran.js ${commande} "nom" "url"`);
          process.exit(1);
        }
        await capturer(commande, nom, url);
        break;
      }

      case 'serie': {
        const [nom, urls, phase = 'avant'] = args;
        if (!nom || !urls) {
          console.error('Usage : node scripts/capture-ecran.js serie "nom" "url1,url2" [avant|apres]');
          process.exit(1);
        }
        await capturerSerie(phase, nom, urls);
        break;
      }

      case 'comparer': {
        const [nom] = args;
        if (!nom) {
          console.error('Usage : node scripts/capture-ecran.js comparer "nom"');
          process.exit(1);
        }
        comparer(nom);
        break;
      }

      case 'lister': {
        listerCaptures();
        break;
      }

      default: {
        console.log(`
Outil de capture d'écran — Plateforme LBH

Commandes disponibles :
  avant   "nom" "url"            Capture avant modification
  apres   "nom" "url"            Capture après modification
  serie   "nom" "url1,url2"      Capture une série de pages
  comparer "nom"                 Compare avant/après (tailles)
  lister                         Liste toutes les captures

Exemples :
  node scripts/capture-ecran.js avant "formulaire-projet" "http://127.0.0.1:3082/projets/nouveau"
  node scripts/capture-ecran.js apres "formulaire-projet" "http://127.0.0.1:3082/projets/nouveau"
  node scripts/capture-ecran.js comparer "formulaire-projet"
        `);
      }
    }
  } catch (erreur) {
    console.error(`\n❌ Erreur : ${erreur.message}`);
    if (erreur.message.includes('ECONNREFUSED') || erreur.message.includes('ERR_CONNECTION_REFUSED')) {
      console.error('   → Le serveur frontend ne répond pas. Vérifier : docker compose ps');
    }
    if (erreur.message.includes('Cannot find module') && erreur.message.includes('playwright')) {
      console.error('   → Playwright non installé. Exécuter :');
      console.error('     cd scripts && npm install && npx playwright install chromium');
    }
    process.exit(1);
  }
})();
