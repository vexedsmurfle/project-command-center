/* Screenshot the Command Center (desktop + mobile) with the sandboxed
 * Chromium via puppeteer-core. Run: node screenshots/shot.js
 * The sandboxed browser cannot reach this VM's loopback server, so the
 * app is loaded via file://.
 *
 * Three states, desktop + mobile each:
 *   -gate    unauthenticated login shell (no data loaded, no passcode yet)
 *   -empty   after unlock with a fresh profile: empty state, no projects
 *   -cards / -project / -tasks  authenticated view with the LOCAL-ONLY
 *            seed injected into localStorage before load. These shots
 *            show project records, so they are gitignored and NEVER
 *            committed — only the gate/empty shots go in the repo.
 *            The seed comes from data/seed.json, which is gitignored.
 */
const fs = require('fs');
const path = require('path');
const puppeteer = require('/home/hatch/workspace/.tools/shot/node_modules/puppeteer-core');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, '..', 'screenshots');
const SEED_PATH = path.join(__dirname, '..', 'data', 'seed.json');
const SEED = fs.existsSync(SEED_PATH) ? JSON.parse(fs.readFileSync(SEED_PATH, 'utf8')) : null;
const STORE = SEED ? { version: 1, updatedAt: new Date().toISOString(), projects: SEED.projects, audit: SEED.audit || [] } : null;

async function newPage(browser, width, height, mobile) {
  const page = await browser.newPage();
  await page.setViewport({ width: width, height: height, isMobile: !!mobile, hasTouch: !!mobile });
  page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));
  return page;
}

async function shootGate(browser, name, width, height, mobile) {
  const page = await newPage(browser, width, height, mobile);
  await page.goto('file://' + path.join(ROOT, 'index.html'), { waitUntil: 'domcontentloaded' });
  await new Promise((r) => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(OUT, name + '-gate.png') });
  await page.close();
}

async function shootEmpty(browser, name, width, height, mobile) {
  const page = await newPage(browser, width, height, mobile);
  await page.goto('file://' + path.join(ROOT, 'index.html'), { waitUntil: 'domcontentloaded' });
  await page.type('#passcode', 'test-passcode');
  await page.click('#unlock-btn');
  await page.waitForSelector('#cards', { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 800));
  await page.screenshot({ path: path.join(OUT, name + '-empty.png') });
  await page.close();
}

async function shootSeeded(browser, name, width, height, mobile) {
  if (!STORE) { console.log('SKIP seeded shots — no local data/seed.json'); return; }
  const page = await newPage(browser, width, height, mobile);
  await page.goto('file://' + path.join(ROOT, 'index.html'), { waitUntil: 'domcontentloaded' });
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
    await shootGate(browser, 'desktop', 1280, 800, false);
    await shootGate(browser, 'mobile', 390, 844, true);
    await shootEmpty(browser, 'desktop', 1280, 800, false);
    await shootEmpty(browser, 'mobile', 390, 844, true);
    await shootSeeded(browser, 'desktop', 1280, 800, false);
    await shootSeeded(browser, 'mobile', 390, 844, true);
    console.log('screenshots written to ' + OUT);
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
