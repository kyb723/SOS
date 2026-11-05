// Run against an already running local SOS server. No public services are used.
import { chromium } from "playwright";
import { existsSync } from "node:fs";
import assert from "node:assert/strict";
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.CHROMIUM_PATH ||
      (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
    });
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(process.env.BASE_URL || "http://localhost:3002");
    await page
      .getByText("Demo changes are saved in this browser only.")
      .waitFor();
    assert.equal(
      await page.evaluate(() => typeof window.ethereum),
      "undefined",
    );
    await page.screenshot({
      path: "/tmp/sos-v3-seeded-week.png",
      fullPage: true,
    });
    const now = new Date();
    const base = new Date(now.getFullYear(), now.getMonth(), 1);
    const key = (d) =>
      `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    await page.evaluate(() =>
      localStorage.setItem(
        "sos.demo.v1",
        JSON.stringify({ version: 1, shifts: [], availability: [] }),
      ),
    );
    await page.reload();
    await page
      .getByText("Demo changes are saved in this browser only.")
      .waitFor();
    for (const width of [375, 390]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      assert.equal(await page.locator(".week-table thead th").count(), 8);
    }
    await page
      .locator(".actions")
      .getByRole("button", { name: "Availability", exact: true })
      .click();
    let d = page.getByRole("dialog");
    assert.equal(
      await d.getByRole("button", { name: "Submit availability" }).isDisabled(),
      true,
    );
    assert.equal(await d.locator(".calendar-grid").count(), 1);
    await page.screenshot({ path: "/tmp/sos-v3-calendar-open.png" });
    await d
      .getByRole("button", { name: `Select ${key(3)}`, exact: true })
      .focus();
    await page.keyboard.press("ArrowRight");
    assert.equal(
      await page.evaluate(() =>
        document.activeElement.getAttribute("aria-label"),
      ),
      `Select ${key(4)}`,
    );
    await page.keyboard.press("Enter");
    assert.equal(
      await d
        .getByRole("button", { name: `Select ${key(4)}`, exact: true })
        .getAttribute("aria-pressed"),
      "true",
    );
    await page.keyboard.press("Enter");
    for (const day of [3, 5, 8, 12])
      await d
        .getByRole("button", { name: `Select ${key(day)}`, exact: true })
        .click();
    await d
      .getByRole("button", { name: `Select ${key(5)}`, exact: true })
      .click();
    assert.equal(
      await d
        .getByRole("button", { name: `Select ${key(5)}`, exact: true })
        .getAttribute("aria-pressed"),
      "false",
    );
    await d
      .getByRole("button", { name: `Select ${key(5)}`, exact: true })
      .click();
    await d.getByRole("button", { name: "Next calendar month" }).click();
    await d.getByRole("button", { name: "Previous calendar month" }).click();
    assert.equal(
      await d
        .getByRole("button", { name: `Select ${key(3)}`, exact: true })
        .getAttribute("aria-pressed"),
      "true",
    );
    await d.getByLabel("Earliest start").fill("09:00");
    await d.getByLabel("Latest finish").fill("18:00");
    await d.getByLabel("CSW", { exact: true }).check();
    await d.getByLabel("Latest finish").fill("08:00");
    assert.equal(
      await d.getByRole("button", { name: "Submit availability" }).isDisabled(),
      true,
    );
    await d.getByLabel("Latest finish").fill("18:00");
    assert.equal(await d.evaluate((e) => e.scrollWidth > e.clientWidth), false);
    await d
      .getByRole("button", { name: "Submit availability" })
      .scrollIntoViewIfNeeded();
    await page.screenshot({ path: "/tmp/sos-v3-calendar.png" });
    await d.getByRole("button", { name: "Submit availability" }).click();
    await d.waitFor({ state: "hidden" });
    let saved = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("sos.demo.v1")),
    );
    assert.equal(saved.availability.length, 1);
    assert.equal(saved.availability[0].dates.length, 4);
    const id = saved.availability[0].id;
    await page
      .locator(".actions")
      .getByRole("button", { name: "Availability", exact: true })
      .click();
    d = page.getByRole("dialog");
    await d
      .getByRole("button", { name: `Select ${key(3)}`, exact: true })
      .click();
    assert.equal(
      await d.getByRole("button", { name: "Submit availability" }).isDisabled(),
      true,
    );
    await d.getByRole("button", { name: /Update existing:/ }).click();
    assert.match(
      await d.getByLabel("Availability summary").innerText(),
      /09:00/,
    );
    await d
      .getByRole("button", { name: `Select ${key(8)}`, exact: true })
      .click();
    await d.getByRole("button", { name: "Submit availability" }).click();
    await d.waitFor({ state: "hidden" });
    saved = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("sos.demo.v1")),
    );
    assert.equal(saved.availability[0].id, id);
    assert.equal(saved.availability[0].dates.length, 3);
    const weekBefore = await page
      .locator(".week-navigation strong")
      .innerText();
    await page.getByRole("button", { name: "Next week", exact: true }).click();
    assert.notEqual(
      await page.locator(".week-navigation strong").innerText(),
      weekBefore,
    );
    await page
      .getByRole("button", { name: "Previous week", exact: true })
      .click();
    assert.equal(
      await page.locator(".week-navigation strong").innerText(),
      weekBefore,
    );
    await page
      .getByRole("button", { name: "Manager Demo", exact: true })
      .click();
    await page.getByRole("button", { name: "+ SH", exact: true }).click();
    d = page.getByRole("dialog");
    await d.getByLabel("SH date").fill(key(10));
    await d.getByLabel("SH code", { exact: true }).selectOption("SH03");
    await d.getByRole("button", { name: "Save SH" }).click();
    await d.waitFor({ state: "hidden" });
    assert.equal(
      (
        await page.evaluate(() =>
          JSON.parse(localStorage.getItem("sos.demo.v1")),
        )
      ).shItems[0].code,
      "SH03",
    );
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole("button", { name: /Edit SH03 for Alex/ }).click();
    d = page.getByRole("dialog");
    await d.getByLabel("SH code", { exact: true }).selectOption("SH04");
    await d.getByRole("button", { name: "Save SH" }).click();
    await page.getByRole("button", { name: "Staff Demo", exact: true }).click();
    assert.equal(await page.locator(".desktop-rota .sh-item").count(), 0);
    await page
      .getByRole("button", { name: "Manager Demo", exact: true })
      .click();
    await page.getByRole("button", { name: /Publish Rota.*\(1\)/ }).click();
    await page
      .getByRole("button", { name: "Confirm publish 1 items", exact: true })
      .click();
    await page.getByRole("button", { name: "Staff Demo", exact: true }).click();
    assert.equal(await page.locator(".desktop-rota .sh-item").count(), 1);
    assert.match(
      await page.locator(".desktop-rota tbody tr").first().innerText(),
      /0h/,
    );
    await page.setViewportSize({ width: 375, height: 844 });
    for (
      let i = 0;
      i < 3 && (await page.locator(".compact-sh").count()) === 0;
      i++
    )
      await page
        .getByRole("button", { name: "Next week", exact: true })
        .click();
    assert.equal(await page.locator(".compact-sh").count(), 1);
    await page
      .getByRole("button", { name: new RegExp(`Alex Chan, ${key(10)},`) })
      .click();
    await page
      .getByRole("dialog")
      .getByText("SH04 · statutory holiday")
      .waitFor();
    await page.keyboard.press("Escape");
    await page.screenshot({ path: "/tmp/sos-v3-week.png", fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.screenshot({ path: "/tmp/sos-v3-desktop.png", fullPage: true });
    await page
      .getByRole("button", { name: "Manager Demo", exact: true })
      .click();
    await page.getByRole("button", { name: "Add shift", exact: true }).click();
    d = page.getByRole("dialog");
    await d.getByLabel("Date", { exact: true }).fill(key(10));
    await d.getByRole("button", { name: "Save shift" }).click();
    await d.getByRole("alert").filter({ hasText: "SH item" }).waitFor();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: /Edit SH04 for Alex/ }).click();
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Delete SH" })
      .click();
    await page.reload();
    await page
      .getByText("Demo changes are saved in this browser only.")
      .waitFor();
    saved = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("sos.demo.v1")),
    );
    assert.equal(saved.shItems.length, 0);
    assert.equal(saved.availability[0].dates.length, 3);
    assert.deepEqual(errors, []);
    const guarded = await browser.newPage();
    const guardedErrors = [];
    guarded.on("pageerror", (e) => guardedErrors.push(e.message));
    await guarded.addInitScript(() =>
      Object.defineProperty(window, "ethereum", {
        get() {
          throw new Error("Unexpected wallet access");
        },
      }),
    );
    await guarded.goto(process.env.BASE_URL || "http://localhost:3002");
    await guarded
      .getByText("Demo changes are saved in this browser only.")
      .waitFor();
    assert.deepEqual(guardedErrors, []);
    console.log(
      "PASS: calendar multi-select/toggle/navigation, disabled validation, duplicate-to-edit flow, mobile modal scroll, seven-day week navigation/details, SH CRUD/publication/zero hours/conflict, staff visibility, persistence, and absent wallet provider.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
