import { chromium } from "playwright";
import { existsSync } from "node:fs";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.CHROMIUM_PATH ||
    (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1100 },
  });
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(process.env.BASE_URL || "http://localhost:3002");
  await page
    .getByText("Demo changes are saved in this browser only.")
    .waitFor();
  const base = new Date();
  const key = (day, offset = 0) => {
    const d = new Date(base.getFullYear(), base.getMonth() + offset, day);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const a = {
    id: "a",
    employeeId: "alex",
    dates: [key(9)],
    start: "09:00",
    end: "18:00",
    branches: ["ST", "CSW"],
    allDay: false,
  };
  const a2 = {
    ...a,
    id: "j",
    employeeId: "jamie",
    dates: [key(10), key(1, 1)],
    branches: ["CSW"],
  };
  const s = {
    id: "j",
    employeeId: "jamie",
    date: key(10),
    branch: "CSW",
    start: "10:00",
    end: "16:00",
    status: "draft",
  };
  const fixture = {
    version: 1,
    availability: [a, a2],
    shifts: [
      s,
      { ...s, id: "future", date: key(1, 1) },
      {
        ...s,
        id: "invalid",
        employeeId: "sam",
        date: key(11),
        branch: "SOHO W",
      },
      {
        ...s,
        id: "legacy",
        employeeId: "alex",
        date: key(1),
        status: "published",
      },
    ],
    shItems: [
      {
        id: "h",
        employeeId: "sam",
        date: key(12),
        branch: "SOHO W",
        code: "SH02",
        status: "draft",
      },
    ],
  };
  await page.evaluate(
    (d) => localStorage.setItem("sos.demo.v1", JSON.stringify(d)),
    fixture,
  );
  await page.reload();
  await page
    .getByText("Demo changes are saved in this browser only.")
    .waitFor();
  assert.equal(await page.locator("main .requests").count(), 0);
  assert.equal(
    await page.getByText("Room for a better rhythm.", { exact: true }).count(),
    0,
  );
  await page.getByRole("button", { name: "Manager Demo", exact: true }).click();
  await page
    .getByRole("button", {
      name: `Schedule Alex Chan on ${key(9)} from availability`,
    })
    .click();
  let d = page.getByRole("dialog");
  assert.equal(
    await d.getByLabel("Team member", { exact: true }).inputValue(),
    "alex",
  );
  assert.equal(
    await d.getByLabel("Date", { exact: true }).inputValue(),
    key(9),
  );
  assert.deepEqual(
    await d
      .getByLabel("Branch", { exact: true })
      .locator("option")
      .allTextContents(),
    ["ST", "CSW"],
  );
  assert.equal(await d.getByLabel("Start time").inputValue(), "09:00");
  assert.equal(await d.getByLabel("Finish time").inputValue(), "18:00");
  await d.locator("form").evaluate((f) => (f.noValidate = true));
  await d.getByLabel("Start time").fill("08:00");
  await d.getByRole("button", { name: "Save shift" }).click();
  await d.getByRole("alert").filter({ hasText: "entire shift" }).waitFor();
  await d.getByLabel("Start time").fill("11:00");
  await d.getByLabel("Finish time").fill("17:00");
  await d.getByRole("button", { name: "Save shift" }).click();
  await d.waitFor({ state: "hidden" });
  assert.equal(
    (await page.evaluate(() => JSON.parse(localStorage.getItem("sos.demo.v1"))))
      .availability.length,
    2,
  );
  await page
    .getByRole("button", {
      name: `Schedule Alex Chan on ${key(9)} from availability`,
    })
    .click();
  d = page.getByRole("dialog");
  await d.getByLabel("Start time").fill("16:00");
  await d.getByRole("button", { name: "Save shift" }).click();
  await d.getByRole("alert").filter({ hasText: "overlapping" }).waitFor();
  await d.getByLabel("Branch", { exact: true }).selectOption("CSW");
  await d.getByLabel("Start time").fill("17:00");
  await d.getByRole("button", { name: "Save shift" }).click();
  await d.waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "Add shift", exact: true }).click();
  d = page.getByRole("dialog");
  await d.getByLabel("Date", { exact: true }).fill(key(11));
  await d.getByRole("button", { name: "Save shift" }).click();
  await d
    .getByRole("alert")
    .filter({ hasText: "No submitted availability" })
    .waitFor();
  await d.getByLabel("Date", { exact: true }).fill(key(9));
  await d.getByLabel("Branch", { exact: true }).evaluate((select) => {
    const option = document.createElement("option");
    option.value = "SOHO W";
    option.text = "SOHO W";
    select.appendChild(option);
  });
  await d.getByLabel("Branch", { exact: true }).selectOption("SOHO W");
  await d.getByLabel("Start time").fill("09:00");
  await d.getByLabel("Finish time").fill("10:00");
  await d.getByRole("button", { name: "Save shift" }).click();
  await d
    .getByRole("alert")
    .filter({ hasText: "branch is not permitted" })
    .waitFor();
  await page.keyboard.press("Escape");
  await page.getByLabel("Branch", { exact: true }).selectOption("ST");
  await page.getByRole("button", { name: /Publish Rota/ }).click();
  d = page.getByRole("dialog");
  await d.getByRole("alert").filter({ hasText: "Sam Wong" }).waitFor();
  assert.equal(
    await d.getByRole("button", { name: /Confirm publish/ }).isDisabled(),
    true,
  );
  await d.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByLabel("Branch", { exact: true }).selectOption("All");
  await page
    .getByRole("button", { name: new RegExp(`Edit Sam Wong, ${key(11)},`) })
    .click();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete shift" })
    .click();
  await page.getByLabel("Branch", { exact: true }).selectOption("ST");
  await page.getByRole("button", { name: /Publish Rota/ }).click();
  d = page.getByRole("dialog");
  await d.getByText(/regardless of the branch filter/).waitFor();
  await page.evaluate(() => {
    window.__sosSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw Error("simulated quota");
    };
  });
  await d.getByRole("button", { name: "Confirm publish 4 items" }).click();
  await d
    .getByRole("alert")
    .filter({ hasText: "Nothing was published" })
    .waitFor();
  assert.equal(
    (
      await page.evaluate(() => JSON.parse(localStorage.getItem("sos.demo.v1")))
    ).shifts.find((s) => s.id === "j").status,
    "draft",
  );
  await page.evaluate(() => {
    Storage.prototype.setItem = window.__sosSetItem;
    delete window.__sosSetItem;
  });
  await d.getByRole("button", { name: "Confirm publish 4 items" }).click();
  await d.waitFor({ state: "hidden" });
  let stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("sos.demo.v1")),
  );
  assert.equal(stored.shifts.find((s) => s.id === "future").status, "draft");
  assert.equal(stored.shifts.find((s) => s.id === "j").status, "published");
  assert.equal(stored.shItems[0].status, "published");
  assert.deepEqual(
    stored.shifts.find((s) => s.id === "legacy"),
    fixture.shifts.find((s) => s.id === "legacy"),
  );
  assert.equal(await page.locator(".legend > span").last().innerText(), "SH");
  await page.getByLabel("Branch", { exact: true }).selectOption("All");
  await page
    .getByRole("button", {
      name: new RegExp(`Edit Alex Chan, ${key(9)}, 11:00`),
    })
    .click();
  d = page.getByRole("dialog");
  await d.getByLabel("Finish time").fill("16:30");
  page.once("dialog", (dialog) => dialog.dismiss());
  await d.getByRole("button", { name: "Save shift" }).click();
  assert.equal(
    (
      await page.evaluate(() => JSON.parse(localStorage.getItem("sos.demo.v1")))
    ).shifts.find(
      (s) =>
        s.employeeId === "alex" && s.date.endsWith("09") && s.start === "11:00",
    ).end,
    "17:00",
  );
  await page.keyboard.press("Escape");
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
  await page.getByRole("button", { name: "Today", exact: true }).click();
  for (
    let i = 0;
    i < 6 &&
    (await page.locator(".week-day").filter({ hasText: "11:00" }).count()) ===
      0;
    i++
  )
    await page.getByRole("button", { name: "Next week", exact: true }).click();
  assert.ok(
    await page.locator(".compact-time").filter({ hasText: "11:00" }).count(),
  );
  await page
    .getByRole("button", { name: new RegExp(`Alex Chan, ${key(9)},`) })
    .click();
  d = page.getByRole("dialog");
  await d
    .getByRole("button", { name: "Add shift from availability" })
    .waitFor();
  await page.keyboard.press("Escape");
  await page.screenshot({ path: "/tmp/sos-v4-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Staff Demo", exact: true }).click();
  assert.equal(await page.locator(".compact-shift.draft").count(), 0);
  await page
    .locator(".actions")
    .getByRole("button", { name: "Availability", exact: true })
    .click();
  d = page.getByRole("dialog");
  await d
    .getByRole("button", { name: "View / edit complete availability history" })
    .click();
  await d.getByRole("heading", { name: "Availability inbox" }).waitFor();
  assert.equal(await d.locator(".request").count(), 1);
  await d
    .getByRole("button", { name: "Edit availability a", exact: true })
    .click();
  await d
    .getByRole("button", { name: `Select ${key(6)}`, exact: true })
    .click();
  await d.getByRole("button", { name: "Submit availability" }).click();
  await d.waitFor({ state: "hidden" });
  await page.reload();
  await page
    .getByText("Demo changes are saved in this browser only.")
    .waitFor();
  stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("sos.demo.v1")),
  );
  assert.equal(stored.availability.find((a) => a.id === "a").dates.length, 2);
  assert.equal(stored.availability.length, 2);
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.screenshot({ path: "/tmp/sos-v4-desktop.png", fullPage: true });
  assert.deepEqual(errors, []);
  console.log(
    "PASS V4: rota-only page, availability prefill and permitted branches/times, manual path restrictions, overlap, persistent availability, invalid-draft publication block, all-branch monthly confirmation, atomic storage failure and retry, unrelated-month preservation, published-edit confirmation, SH last, seven-day times/details, Staff history editing and mobile overflow.",
  );
} finally {
  await browser.close();
}
