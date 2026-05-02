const { chromium } = require('playwright');

(async () => {
  const nav = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' });
  const page = await ctx.newPage();

  // Connexion
  await page.goto('http://127.0.0.1:3082/connexion', { waitUntil: 'networkidle' });
  await page.fill('input[name="courriel"]', 'admin@lbh-economiste.com');
  await page.fill('input[name="mot_de_passe"]', '@Sharingan06200');
  await page.click('button[type="submit"]');
  await page.waitForURL(u => !u.toString().includes('/connexion'), { timeout: 15000 });

  // Navigue vers le métré
  await page.goto('http://127.0.0.1:3082/projets/2e85529f-32e7-4494-a8cd-6b5ed2b71500/metres/52d348cd-3a06-41a9-8f4f-39d06eec8cbe', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Clique sur l'onglet Métré visuel
  await page.click('text=Métré visuel');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/var/www/vhosts/lbh-economiste.com/httpdocs/scripts/captures/metre-visuel-tab.png', fullPage: false });
  console.log('✓ Screenshot métré visuel');

  await nav.close();
})();
