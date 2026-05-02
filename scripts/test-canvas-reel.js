const { chromium } = require('playwright');
const path = require('path');

const PROJET_ID = '2e85529f-32e7-4494-a8cd-6b5ed2b71500';
const METRE_ID = '52d348cd-3a06-41a9-8f4f-39d06eec8cbe';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  // Connexion
  await page.goto('http://127.0.0.1:3082/connexion', { waitUntil: 'networkidle' });
  await page.fill('input[name="courriel"]', 'admin@lbh-economiste.com');
  await page.fill('input[name="mot_de_passe"]', '@Sharingan06200');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(4000);
  console.log('Connecté:', !page.url().includes('connexion'));

  // Naviguer vers le métré
  await page.goto(`http://127.0.0.1:3082/projets/${PROJET_ID}/metres/${METRE_ID}`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Cliquer sur l'onglet Métré visuel
  const onglet = page.locator('button').filter({ hasText: /métré visuel/i });
  const cnt = await onglet.count();
  console.log('Onglet Métré visuel:', cnt);
  if (cnt > 0) await onglet.first().click();

  // Attendre le chargement du fond de plan (apercu + swap HD)
  await page.waitForTimeout(15000);

  // Screenshot de la page entière
  await page.screenshot({ 
    path: path.join(__dirname, 'captures', 'condition-reelle-canvas.png'), 
    fullPage: false 
  });

  // Analyse des pixels du canvas
  const info = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return { erreur: 'Pas de canvas' };
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const data = ctx.getImageData(0, 0, w, h).data;
    let colored = 0, dark = 0;
    // Palettes de couleurs
    let reds = 0, greens = 0, blues = 0, cyans = 0, magentas = 0, yellows = 0, whites = 0;
    for (let i = 0; i < data.length; i += 16) {
      const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
      if (a < 10) continue;
      const lum = 0.299*r + 0.587*g + 0.114*b;
      if (lum > 30) {
        colored++;
        if (r > 150 && g < 80 && b < 80) reds++;
        else if (r < 80 && g > 150 && b < 80) greens++;
        else if (r < 80 && g < 80 && b > 150) blues++;
        else if (r < 80 && g > 150 && b > 150) cyans++;
        else if (r > 150 && g < 80 && b > 150) magentas++;
        else if (r > 150 && g > 150 && b < 80) yellows++;
        else if (r > 180 && g > 180 && b > 180) whites++;
      } else dark++;
    }
    return { w, h, colored, dark, pctColored: Math.round(colored*100/(colored+dark+1)),
             reds, greens, blues, cyans, magentas, yellows, whites };
  });

  console.log('Canvas:', JSON.stringify(info, null, 2));
  await browser.close();
})();
