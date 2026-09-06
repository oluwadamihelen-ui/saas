import { chromium } from "playwright";

const BASE = "http://localhost:3000";

async function main() {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  console.log("1. Login as customer...");
  await page.goto(`${BASE}/login`);
  await page.fill("#email", "sarah@brightretail.com");
  await page.fill("#password", "Passw0rd!");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/dashboard`, { timeout: 10000 });
  console.log("   Logged in, on dashboard.");

  console.log("2. Browse marketplace and open an app...");
  await page.goto(`${BASE}/apps/stockflow-inventory`);
  await page.waitForSelector("text=Purchase Application");

  console.log("3. Go to checkout...");
  await page.click("text=Purchase Application");
  await page.waitForURL(/\/checkout\/stockflow-inventory/);
  await page.check('input[name="includeInstallation"]');
  await page.check('input[value="MANAGED"]');
  await page.fill("#billingPhone", "+2348012345678");
  await page.fill("#billingCountry", "Nigeria");

  console.log("4. Submit checkout...");
  await Promise.all([page.waitForURL(/\/checkout\/mock-pay/, { timeout: 15000 }), page.click("text=Continue to Payment")]);
  console.log("   Reached mock payment page:", page.url());

  console.log("5. Confirm mock payment...");
  await Promise.all([page.waitForURL(/\/checkout\/callback/, { timeout: 15000 }), page.click('button:has-text("Pay")')]);
  const callbackText = await page.textContent("h1");
  console.log("   Callback page heading:", callbackText);

  console.log("6. View order in dashboard...");
  await page.click("text=View Order");
  await page.waitForURL(/\/dashboard\/orders\//);
  const orderStatusVisible = await page.isVisible("text=Paid");
  console.log("   Order page loaded, 'Paid' badge visible:", orderStatusVisible);

  console.log("7. Check deployments list...");
  await page.goto(`${BASE}/dashboard/deployments`);
  await page.waitForSelector("text=StockFlow Inventory");
  console.log("   Deployment for StockFlow Inventory visible.");

  if (errors.length > 0) {
    console.log("Console/page errors observed:");
    for (const e of errors) console.log(" -", e);
  } else {
    console.log("No console/page errors observed.");
  }

  await browser.close();
  console.log("SMOKE TEST PASSED");
}

main().catch((err) => {
  console.error("SMOKE TEST FAILED:", err);
  process.exit(1);
});
