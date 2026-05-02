const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const PROJET_ID = '2e85529f-32e7-4494-a8cd-6b5ed2b71500';
const METRE_ID = '52d348cd-3a06-41a9-8f4f-39d06eec8cbe';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });

  await page.goto('http://127.0.0.1:3082/connexion', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  
  const inputs = await page.evaluate(() => Array.from(document.querySelectorAll('input')).map(i => i.name));
  console.log('Inputs:', inputs);
  
  await page.fill('input[name="courriel"]', 'admin@lbh-economiste.com');
  await page.locator('input[name="mot_de_passe"]').pressSequentially('@Sharingan06200', { delay: 15 });
  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);
  console.log('URL:', page.url());
  if (page.url().includes('connexion')) { await browser.close(); return; }

  await page.goto(`http://127.0.0.1:3082/projets/${PROJET_ID}/metres/${METRE_ID}`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('isuel'));
    if (btn) btn.click();
  });
  await page.waitForTimeout(18000);

  const canvasData = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    if (!c) return null;
    return { w: c.width, h: c.height, dataUrl: c.toDataURL('image/png') };
  });

  if (canvasData) {
    console.log(`Canvas: ${canvasData.w}x${canvasData.h}`);
    const b64 = canvasData.dataUrl.replace(/^data:image\/png;base64,/, '');
    fs.writeFileSync(path.join(__dirname, 'captures', 'canvas-exact.png'), Buffer.from(b64, 'base64'));
    console.log('Sauvé');
  }
  await browser.close();
})();
