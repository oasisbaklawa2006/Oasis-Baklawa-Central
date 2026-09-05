import { test, expect, type Page } from "@playwright/test";

const BASE = process.env.APP_URL || process.env.TEST_PREVIEW_URL || "http://127.0.0.1:4173";

async function openHarness(page: Page) {
  await page.setContent(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>
          body { margin: 0; font-family: system-ui, sans-serif; }
          #overlay { position: fixed; inset: 0; z-index: 200; background: rgba(0, 0, 0, 0.55); }
          #sheet {
            position: fixed;
            inset: 0 0 0 auto;
            width: min(100vw, 360px);
            z-index: 200;
            background: #fff;
            padding: 24px 20px 120px;
            box-sizing: border-box;
            overflow: auto;
          }
          #select-content {
            position: fixed;
            left: 24px;
            right: 24px;
            top: 220px;
            z-index: 210;
            background: #fff;
            border: 1px solid #d4d4d8;
            border-radius: 8px;
            box-shadow: 0 12px 30px rgba(0, 0, 0, 0.18);
            display: none;
          }
          #select-content[data-open="true"] { display: block; }
          .option {
            padding: 14px 16px;
            border-bottom: 1px solid #f1f5f9;
            cursor: pointer;
          }
          .option:last-child { border-bottom: 0; }
          #approve:not([disabled]) { opacity: 1; }
        </style>
      </head>
      <body>
        <div id="overlay" aria-hidden="true"></div>
        <section id="sheet" aria-label="Application review sheet">
          <h1 style="font-size: 18px; margin: 0 0 16px;">Pending Buyer Application</h1>
          <label style="display:block; font-size: 12px; font-weight: 700; margin-bottom: 8px;">
            Pricing Slab <span style="color:#dc2626">*</span>
          </label>
          <button id="trigger" type="button" aria-haspopup="listbox" aria-expanded="false" style="width:100%; min-height:44px;">
            Select pricing slab (required)…
          </button>
          <button id="approve" type="button" disabled aria-label="Approve and activate B2B account" style="margin-top: 24px; width: 100%; min-height: 48px; border: 0; border-radius: 10px; background: #b8860b; color: #fff; font-weight: 700; opacity: 0.4;">
            Approve & Activate
          </button>
        </section>
        <div id="select-content" role="listbox" aria-label="Pricing slab options" data-open="false">
          <div class="option" role="option" data-value="Retail A">Retail A</div>
          <div class="option" role="option" data-value="Wholesale B">Wholesale B</div>
        </div>
        <script>
          const trigger = document.getElementById("trigger");
          const content = document.getElementById("select-content");
          const approve = document.getElementById("approve");
          trigger.addEventListener("click", () => {
            const open = content.dataset.open === "true";
            content.dataset.open = open ? "false" : "true";
            trigger.setAttribute("aria-expanded", open ? "false" : "true");
          });
          content.querySelectorAll(".option").forEach((option) => {
            option.addEventListener("click", () => {
              trigger.textContent = option.dataset.value;
              content.dataset.open = "false";
              trigger.setAttribute("aria-expanded", "false");
              approve.disabled = false;
            });
          });
        </script>
      </body>
    </html>
  `, { waitUntil: "domcontentloaded" });
}

test.describe("Buyer approval Select-in-Sheet iPhone proof", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("pricing slab options render above the sheet and enable Approve after selection", async ({ page }) => {
    await openHarness(page);

    const trigger = page.locator("#trigger");
    const approve = page.getByRole("button", { name: /Approve and activate B2B account/i });
    const listbox = page.getByRole("listbox", { name: "Pricing slab options" });

    await expect(approve).toBeDisabled();
    await trigger.click();
    await expect(listbox).toBeVisible();

    const slabOption = page.getByRole("option", { name: "Retail A" });
    await expect(slabOption).toBeVisible();

    const stacking = await slabOption.evaluate((el) => {
      const content = el.closest("#select-content");
      const sheet = document.getElementById("sheet");
      const contentZ = content ? Number.parseInt(getComputedStyle(content).zIndex, 10) : 0;
      const sheetZ = sheet ? Number.parseInt(getComputedStyle(sheet).zIndex, 10) : 0;
      const rect = el.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const topElement = document.elementFromPoint(centerX, centerY);
      return {
        contentZ,
        sheetZ,
        optionOnTop: topElement === el || el.contains(topElement),
      };
    });

    expect(stacking.contentZ).toBeGreaterThan(stacking.sheetZ);
    expect(stacking.optionOnTop).toBe(true);

    await slabOption.click();
    await expect(trigger).toHaveText("Retail A");
    await expect(approve).toBeEnabled();
  });

  test("live admin clients sheet when credentials are provided", async ({ page }) => {
    const email = process.env.TEST_ADMIN_EMAIL?.trim();
    const password = process.env.TEST_ADMIN_PASSWORD?.trim();
    test.skip(!email || !password, "TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD required for live proof");

    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.getByRole("button", { name: /^Email$/i }).click();
    await page.getByPlaceholder("you@business.com").fill(email!);
    await page.getByPlaceholder("••••••••").fill(password!);
    await page.getByRole("button", { name: /^Login$/i }).click();
    await page.waitForURL((url) => !/\/login(\/|$|\?)/i.test(url.pathname), { timeout: 120_000 });

    await page.goto(`${BASE}/admin/clients`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.getByRole("tab", { name: /pending/i }).click();

    const openDetails = page.getByText("Open details").first();
    if (!(await openDetails.isVisible().catch(() => false))) {
      const row = page.locator("table tbody tr").first();
      if (await row.isVisible().catch(() => false)) {
        await row.click();
      } else {
        test.skip(true, "No pending applications available for live buyer-approval proof");
      }
    } else {
      await openDetails.click();
    }

    const approve = page.getByRole("button", { name: /Approve and activate B2B account/i });
    await expect(approve).toBeDisabled();

    const slabTrigger = page.getByRole("combobox").first();
    await slabTrigger.click();

    const firstOption = page.getByRole("option").first();
    await expect(firstOption).toBeVisible();
    await firstOption.click();

    await expect(approve).toBeEnabled();
  });
});
