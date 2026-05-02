const { chromium } = require('playwright');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // Login
  await page.goto('http://127.0.0.1:3082/connexion', { waitUntil: 'networkidle' });
  await page.locator('input[type="email"]').fill('admin@lbh-economiste.com');
  await page.locator('input[type="password"]').pressSequentially('@Sharingan06200', { delay: 15 });
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(u => !u.toString().includes('/connexion'), { timeout: 15000 });
  console.log('Connecté');

  // Navigate to the metre page
  await page.goto('http://127.0.0.1:3082/projets/2e85529f-32e7-4494-a8cd-6b5ed2b71500/metres/52d348cd-3a06-41a9-8f4f-39d06eec8cbe', { waitUntil: 'networkidle' });

  // Click on "Métré visuel" tab
  const tabMetreVisuel = page.locator('button:has-text("Métré visuel")');
  await tabMetreVisuel.waitFor({ timeout: 10000 });
  await tabMetreVisuel.click();
  console.log('Onglet Métré visuel cliqué');

  // Wait for canvas to load
  await page.waitForTimeout(5000);

  await page.screenshot({ path: '/tmp/metre-visuel-canvas.png', fullPage: false });
  console.log('Screenshot pris');
  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
