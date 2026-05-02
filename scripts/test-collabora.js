#!/usr/bin/env node
/**
 * Test interactif Collabora Online — Plateforme LBH
 * Usage : node scripts/test-collabora.js [email] [mot_de_passe]
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'https://www.lbh-economiste.com';
const CAPTURES = path.join(__dirname, 'captures');
if (!fs.existsSync(CAPTURES)) fs.mkdirSync(CAPTURES, { recursive: true });

const ts = () => new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const capture = (page, nom) => {
  const f = path.join(CAPTURES, `collabora_${nom}_${ts()}.png`);
  return page.screenshot({ path: f, fullPage: false }).then(() => console.log(`  📸 ${f}`));
};

(async () => {
  const email = process.argv[2] || 'admin@lbh-economiste.com';
  const mdp   = process.argv[3] || '';

  const navigateur = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  const contexte = await navigateur.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });

  // Collecter les messages de console et les erreurs réseau
  const logs = [];
  const erreurs = [];
  const requetes = [];

  const page = await contexte.newPage();

  page.on('console', msg => {
    const txt = `[${msg.type()}] ${msg.text()}`;
    logs.push(txt);
    if (msg.type() === 'error') console.log(`  🔴 Console: ${txt}`);
  });

  page.on('requestfailed', req => {
    const err = `FAIL ${req.method()} ${req.url()} — ${req.failure()?.errorText}`;
    erreurs.push(err);
    console.log(`  ❌ Requête échouée: ${err}`);
  });

  page.on('websocket', ws => {
    console.log(`  🔌 WebSocket ouvert: ${ws.url()}`);
    ws.on('socketerror', err => console.log(`  ❌ WebSocket erreur: ${err}`));
    ws.on('close', () => console.log(`  🔌 WebSocket fermé: ${ws.url().slice(0, 80)}...`));
  });

  try {
    // 1. Connexion
    console.log('\n1. Connexion...');
    await page.goto(`${BASE_URL}/connexion`, { waitUntil: 'networkidle', timeout: 30000 });
    await capture(page, '01_page_connexion');

    await page.fill('input[type="email"], input[name="courriel"]', email);
    await page.fill('input[type="password"], input[name="mot_de_passe"]', mdp);
    await page.click('button[type="submit"]');
    await page.waitForURL(`${BASE_URL}/`, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);
    await capture(page, '02_apres_connexion');
    console.log(`   URL actuelle: ${page.url()}`);

    // 2. Navigation vers modeles-documents
    console.log('\n2. Navigation vers modèles de documents...');
    await page.goto(`${BASE_URL}/administration/modeles-documents`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    await capture(page, '03_modeles_documents');

    // 3. Sélectionner un modèle (clic sur le premier dans la liste)
    console.log('\n3. Sélection d\'un modèle...');
    const premierModele = page.locator('button, [role="button"], li').filter({ hasText: /lettre|courrier|rapport|note|modele|CCTP|BPU|DPGF/i }).first();
    const nbModeles = await premierModele.count();
    console.log(`   Modèles trouvés: ${nbModeles}`);

    if (nbModeles > 0) {
      await premierModele.click();
      await page.waitForTimeout(1000);
    } else {
      // Essayer de cliquer sur le premier élément de liste
      const listeItems = page.locator('li, [data-testid], .modele-item').first();
      if (await listeItems.count() > 0) {
        await listeItems.click();
        await page.waitForTimeout(1000);
      }
    }
    await capture(page, '04_modele_selectionne');

    // 4. Cliquer sur le bouton "Ouvrir dans Collabora"
    console.log('\n4. Clic sur "Ouvrir dans Collabora"...');
    const boutonCollabora = page.locator('button').filter({ hasText: /collabora|bureautique|ouvrir/i }).first();
    const nbBoutons = await boutonCollabora.count();
    console.log(`   Boutons Collabora trouvés: ${nbBoutons}`);

    if (nbBoutons > 0) {
      const texte = await boutonCollabora.textContent();
      console.log(`   Clic sur: "${texte?.trim()}"`);
      await boutonCollabora.click();
    } else {
      console.log('   ⚠️  Bouton Collabora non trouvé, capture de l\'état actuel');
    }

    // 5. Observer le chargement (attendre 5s puis capturer)
    console.log('\n5. Attente du chargement Collabora (5s)...');
    await page.waitForTimeout(5000);
    await capture(page, '05_collabora_5s');

    // 6. Attente supplémentaire (10s au total)
    console.log('\n6. Attente supplémentaire (5s)...');
    await page.waitForTimeout(5000);
    await capture(page, '06_collabora_10s');

    // 7. Vérifier le contenu de l'iframe
    console.log('\n7. Inspection de l\'iframe Collabora...');
    const iframes = page.frames();
    console.log(`   Nombre de frames: ${iframes.length}`);
    for (const frame of iframes) {
      const url = frame.url();
      if (url && url !== 'about:blank' && url !== page.url()) {
        console.log(`   Frame URL: ${url.slice(0, 100)}`);
        try {
          const contenu = await frame.textContent('body', { timeout: 2000 });
          if (contenu) console.log(`   Frame contenu (200 chars): ${contenu.slice(0, 200)}`);
        } catch (e) {
          console.log(`   Frame non accessible: ${e.message.slice(0, 80)}`);
        }
      }
    }

    // 8. Capture finale
    await capture(page, '07_etat_final');

    // 9. Rapport
    console.log('\n═══════════════════════════════════');
    console.log('RAPPORT DE TEST');
    console.log('═══════════════════════════════════');
    console.log(`\nErreurs réseau (${erreurs.length}):`);
    erreurs.forEach(e => console.log(`  - ${e}`));
    console.log(`\nMessages console erreur (${logs.filter(l => l.startsWith('[error]')).length}):`);
    logs.filter(l => l.startsWith('[error]')).forEach(l => console.log(`  - ${l}`));

  } catch (erreur) {
    console.error(`\n❌ Erreur: ${erreur.message}`);
    await capture(page, '99_erreur').catch(() => {});
  } finally {
    await navigateur.close();
  }
})();
