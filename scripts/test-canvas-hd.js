const { chromium } = require('playwright');
const path = require('path');

const PROJET_ID = '2e85529f-32e7-4494-a8cd-6b5ed2b71500';
const METRE_ID = '52d348cd-3a06-41a9-8f4f-39d06eec8cbe';
const URL_METRE = `http://127.0.0.1:3082/projets/${PROJET_ID}/metres/${METRE_ID}`;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('http://127.0.0.1:3082/connexion', { waitUntil: 'networkidle' });
  
  await page.fill('input[name="courriel"]', 'admin@lbh-economiste.com');
  await page.fill('input[name="mot_de_passe"]', 'TestPass@2026');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);
  console.log('URL après login:', page.url());
  
  if (page.url().includes('connexion')) {
    console.log('Échec connexion');
    await browser.close();
    return;
  }
  
  await page.goto(URL_METRE, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  console.log('URL métré:', page.url());
  
  const buttons = await page.evaluate(() =>
    Array.from(document.querySelectorAll('button')).map(b => b.textContent?.trim()).filter(t => t).slice(0, 30)
  );
  console.log('Boutons:', buttons);

  // Cliquer sur onglet métré visuel
  const onglet = page.locator('button').filter({ hasText: /visuel/i });
  const cnt = await onglet.count();
  console.log('Onglets visuel:', cnt);
  if (cnt > 0) {
    await onglet.first().click();
    await page.waitForTimeout(12000);
  }

  await page.screenshot({ path: path.join(__dirname, 'captures', 'test-canvas-hd-apres.png'), fullPage: false });

  const canvasInfo = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return { erreur: 'Pas de canvas' };
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const data = ctx.getImageData(0, 0, w, h).data;
    let colored = 0, dark = 0;
    for (let i = 0; i < data.length; i += 16) {
      const lum = 0.299*data[i] + 0.587*data[i+1] + 0.114*data[i+2];
      if (data[i+3] < 10) continue;
      if (lum > 30) colored++; else dark++;
    }
    return { w, h, colored, dark, pctColored: Math.round(colored*100/(colored+dark+1)) };
  });
  console.log('Canvas:', canvasInfo);
  
  await browser.close();
})();
