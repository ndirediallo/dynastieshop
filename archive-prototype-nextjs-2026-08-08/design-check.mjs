import { chromium } from "playwright";

const SCREEN_DIR =
  "/private/tmp/claude-501/-Users-dialloalhassane-Documents-MY-DOCS-DYNASTIE-GESTION/64594af7-f288-4db5-a981-515fb12eca45/scratchpad/screenshots";

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await context.newPage();

const consoleErrors = [];
page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
page.on("pageerror", (err) => consoleErrors.push(err.message));

await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
await page.waitForTimeout(500);
await page.screenshot({ path: `${SCREEN_DIR}/v2-01-login.png` });

await page.fill('input#email', "ndireetmoi@gmail.com");
await page.fill('input#password', "DynastieShop2026!");
await page.click('button[type="submit"]');
await page.waitForURL("**/dashboard", { timeout: 10000 });
await page.waitForLoadState("networkidle");
await page.waitForTimeout(500);
await page.screenshot({ path: `${SCREEN_DIR}/v2-02-dashboard.png`, fullPage: true });

await page.click('a[href="/boutiques"]');
await page.waitForLoadState("networkidle");
await page.waitForTimeout(300);
await page.screenshot({ path: `${SCREEN_DIR}/v2-03-boutiques.png`, fullPage: true });

await page.click('a[href="/utilisateurs"]');
await page.waitForLoadState("networkidle");
await page.waitForTimeout(300);
await page.screenshot({ path: `${SCREEN_DIR}/v2-04-utilisateurs.png`, fullPage: true });

await page.click('a[href="/parametres"]');
await page.waitForLoadState("networkidle");
await page.waitForTimeout(300);
await page.screenshot({ path: `${SCREEN_DIR}/v2-05-parametres.png`, fullPage: true });

// toggle to dark mode to verify it still works well
await page.locator('button[aria-label="Changer de thème"]').click();
await page.waitForTimeout(300);
await page.screenshot({ path: `${SCREEN_DIR}/v2-06-dashboard-dark.png`, fullPage: true });

console.log("Console errors:", consoleErrors.length ? consoleErrors.join(" | ") : "(none)");

await browser.close();
