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

  console.log("1. Log in as customer (already holds an active StockFlow Inventory license)...");
  await page.goto(`${BASE}/login`);
  await page.fill("#email", "sarah@brightretail.com");
  await page.fill("#password", "Passw0rd!");
  await page.click('button[type="submit"]');
  try {
    await page.waitForURL(`${BASE}/dashboard`, { timeout: 30000 });
  } catch (e) {
    console.log("   Current URL:", page.url());
    console.log("   Body snippet:", (await page.textContent("body"))?.slice(0, 500));
    throw e;
  }
  console.log("   Logged in.");

  console.log("2. Request a new deployment (Managed) for StockFlow Inventory v1.0.0...");
  await page.goto(`${BASE}/dashboard/deployments/new`);
  await page.waitForSelector("#applicationId");
  await page.selectOption("#applicationId", { label: "StockFlow Inventory" });
  // Managed is the default-selected radio; submit directly.
  await Promise.all([page.waitForURL(/\/dashboard\/deployments\/[a-f0-9-]+$/, { timeout: 15000 }), page.click('button:has-text("Deploy Your Application")')]);
  const deploymentUrl = page.url();
  const deploymentId = deploymentUrl.split("/").pop();
  console.log("   Deployment created:", deploymentId);

  console.log("3. Poll customer deployment page until it reports success...");
  let customerCompleted = false;
  for (let i = 0; i < 30; i++) {
    await page.reload();
    const bodyText = await page.textContent("body");
    if (/completed successfully/i.test(bodyText)) {
      customerCompleted = true;
      break;
    }
    if (/\bfailed\b|needs.{0,3}action/i.test(bodyText)) {
      console.log("   Unexpected non-success state, body snippet:", bodyText.slice(0, 400));
      break;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.log("   Customer sees success message:", customerCompleted);

  console.log("4. Log out, log in as admin, open the same deployment...");
  await page.context().clearCookies();
  await page.goto(`${BASE}/login`);
  await page.fill("#email", "admin@bridgecodes.example");
  await page.fill("#password", "Passw0rd!");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(dashboard|admin)/, { timeout: 15000 });

  await page.goto(`${BASE}/admin/deployments/${deploymentId}`);
  const adminBody = await page.textContent("body");
  const adminSeesCompleted = /Completed/i.test(adminBody);
  const adminSeesTarget = /Demo Infrastructure|MOCK|mock/i.test(adminBody);
  console.log("   Admin sees COMPLETED status:", adminSeesCompleted);
  console.log("   Admin sees deployment target info:", adminSeesTarget);

  if (errors.length > 0) {
    console.log("Console/page errors observed:");
    for (const e of errors) console.log(" -", e);
  } else {
    console.log("No console/page errors observed.");
  }

  await browser.close();

  if (!customerCompleted || !adminSeesCompleted) {
    throw new Error("Acceptance flow did not reach the expected COMPLETED state");
  }
  console.log("ACCEPTANCE TEST PASSED");
}

main().catch((err) => {
  console.error("ACCEPTANCE TEST FAILED:", err);
  process.exit(1);
});
