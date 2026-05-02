const { chromium } = require('playwright');
const path = require('path');

const PROJET_ID = '2e85529f-32e7-4494-a8cd-6b5ed2b71500';
const METRE_ID = '52d348cd-3a06-41a9-8f4f-39d06eec8cbe';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });

  await page.goto('http://127.0.0.1:3082/connexion', { waitUntil: 'networkidle' });
  
  await page.click('input[name="courriel"]');
  await page.keyboard.type('admin@lbh-economiste.com', { delay: 30 });
  await page.click('input[name="mot_de_passe"]');
  await page.keyboard.type('@Sharingan06200', { delay: 30 });
  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);
  console.log('URL après login:', page.url());

  if (page.url().includes('connexion')) {
    // Vérifier le message d'erreur
    const err = await page.evaluate(() => document.body.innerText.substring(0, 200));
    console.log('Page:', err.substring(0, 100));
    await browser.close();
    return;
  }

  await page.goto(`http://127.0.0.1:3082/projets/${PROJET_ID}/metres/${METRE_ID}`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('isuel'));
    if (btn) btn.click();
  });
  await page.waitForTimeout(15000);

  const canvas = await page.$('canvas');
  if (!canvas) { console.log('Pas de canvas'); await browser.close(); return; }

  const box = await canvas.boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  for (let i = 0; i < 8; i++) {
    await page.mouse.move(cx, cy);
    await page.mouse.wheel(0, -300);
    await page.waitForTimeout(200);
  }
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(__dirname, 'captures', 'canvas-zoom-hachures.png') });
  console.log('OK');
  await browser.close();
})();
