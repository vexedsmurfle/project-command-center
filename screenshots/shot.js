/* Screenshot the Command Center (desktop + mobile) with the sandboxed
 * Chromium via puppeteer-core. Run: node screenshots/shot.js
 * The sandboxed browser cannot reach this VM's loopback server, so the
 * app is loaded via file:// and the seed record is injected into
 * localStorage before load (the app's normal first-run path).
 */
const fs = require('fs');
const path = require('path');
const puppeteer = require('/tmp/node_modules/puppeteer-core');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, '..', 'screenshots');
const SEED = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'seed.json'), 'utf8'));
const STORE = { version: 1, updatedAt: new Date().toISOString(), projects: SEED.projects, audit: SEED.audit || [] };

async function shoot(browser, name, width, height, mobile) {
  const page = await browser.newPage();
  await page.setViewport({ width: width, height: height, isMobile: !!mobile, hasTouch: !!mobile });
  const url = 'file://' + path.join(ROOT, 'index.html');
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.evaluate((store) => {
    localStorage.setItem('pcc-store-v1', JSON.stringify(store));
  }, STORE);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.type('#passcode', 'test-passcode');
  await page.click('#unlock-btn');
  await page.waitForSelector('#cards', { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 800));
  await page.screenshot({ path: path.join(OUT, name + '-cards.png') });
  await page.evaluate(() => { document.querySelector('.card').click(); });
  await new Promise((r) => setTimeout(r, 500));
  await page.screenshot({ path: path.join(OUT, name + '-project.png') });
  await page.evaluate(() => { document.querySelector('[data-tab="tasks"]').click(); });
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: path.join(OUT, name + '-tasks.png') });
  await page.close();
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/opt/hatch/bin/hatch-chromium-sandbox',
    pipe: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files'],
  });
  try {
    await shoot(browser, 'desktop', 1280, 800, false);
    await shoot(browser, 'mobile', 390, 844, true);
    console.log('screenshots written to ' + OUT);
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
