const assert = require("node:assert/strict");
const { resolve } = require("node:path");
const { execFileSync } = require("node:child_process");
const { chromium } = require("playwright-core");
const publicOnly = process.argv.includes("--public");
const base = process.env.E2E_FRONTEND_URL || "http://127.0.0.1:8080";
const backend = process.env.E2E_BACKEND_URL || "http://127.0.0.1:3001";

async function run() {
  if (!publicOnly) {
    assert.ok(
      process.env.E2E_EMAIL && process.env.E2E_PASSWORD,
      "Configure E2E_EMAIL e E2E_PASSWORD localmente.",
    );
    execFileSync("npm", ["--prefix", "frontend", "run", "test:e2e"], {
      cwd: resolve(__dirname, "../.."),
      stdio: "inherit",
      env: { ...process.env, E2E_FRONTEND_URL: base, E2E_BACKEND_URL: backend },
    });
  }
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
    headless: true,
  });
  try {
    for (const width of [390, 820, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", () => errors.push("JavaScript exception"));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push("Console error");
      });
      page.on("response", (response) => {
        if (response.status() >= 400) errors.push("HTTP " + response.status());
      });
      await page.goto(base + "/login", { waitUntil: "networkidle" });
      if (!publicOnly) {
        await page.locator('input[type="email"]').fill(process.env.E2E_EMAIL);
        await page.locator("#login-password").fill(process.env.E2E_PASSWORD);
        await page.locator('button[type="submit"]').click();
        await page.waitForURL("**/dashboard**");
        const response = await context.request.get(backend + "/leads?page=1&pageSize=1");
        assert.equal(response.status(), 200);
        const leads = await response.json();
        const paths = [
          "/dashboard",
          "/leads-b2b",
          "/mapa-oportunidades",
          "/funil-comercial",
          "/atividades-comerciais",
          "/configuracoes",
        ];
        if (leads.items[0]) paths.push("/leads-b2b/" + encodeURIComponent(leads.items[0].id));
        if (process.env.E2E_EXPECTED_ROLE === "ADMIN") paths.push("/importar-cnpjs");
        for (const path of paths) {
          await page.goto(base + path, { waitUntil: "networkidle" });
          assert.notEqual(new URL(page.url()).pathname, "/login", path);
          assert.equal(
            await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
            false,
            path,
          );
          console.log(JSON.stringify({ width, path, rendered: true }));
        }
      } else {
        await page.getByRole("button", { name: "Exibir senha" }).click();
        await page.getByRole("button", { name: "Ocultar senha" }).click();
        await page.getByText("Esqueci minha senha", { exact: true }).click();
        await page.getByRole("heading", { name: "Recuperar senha" }).waitFor();
      }
      assert.deepEqual(errors, [], "Browser errors at width " + width);
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
      );
      console.log(JSON.stringify({ width, publicOnly, errors: 0 }));
      await context.close();
    }
  } finally {
    await browser.close();
  }
}
run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
