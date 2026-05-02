const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1600, height: 900 });

  await page.goto('http://127.0.0.1:3082/connexion');
  await page.fill('input[type=email]', 'admin@lbh-economiste.com');
  await page.fill('input[type=password]', '@Sharingan06200');
  await page.click('button[type=submit]');
  await page.waitForLoadState('networkidle');

  const url = 'http://127.0.0.1:3082/projets/2e85529f-32e7-4494-a8cd-6b5ed2b71500/metres/52d348cd-3a06-41a9-8f4f-39d06eec8cbe';
  await page.goto(url);
  await page.waitForLoadState('networkidle');
  await page.click('text=Métré visuel');
  await page.waitForTimeout(2000);

  const data = await page.evaluate(async () => {
    // Récupérer le token depuis localStorage
    const token = localStorage.getItem('access') || localStorage.getItem('token') ||
      Object.keys(localStorage).map(k => localStorage.getItem(k)).find(v => v && v.length > 100 && v.startsWith('ey'));
    const res = await fetch('/api/metres/52d348cd-3a06-41a9-8f4f-39d06eec8cbe/fonds-plan/', {
      headers: token ? { 'Authorization': 'Bearer ' + token } : {}
    });
    return await res.text();
  });
  console.log(data.substring(0, 2000));
  await browser.close();
})();
