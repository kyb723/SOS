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
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const base = process.env.BASE_URL || "http://localhost:3002";
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + "/team");
  await page.waitForURL("**/login");
  await page.getByRole("heading", { name: "Team sign in" }).waitFor();
  await page.screenshot({ path: "/tmp/sos-v5-login.png" });
  await page.goto(base + "/account");
  await page.waitForURL("**/login");
  const response = await page.request.get(base + "/api/schedule");
  assert.ok([401, 403, 503].includes(response.status()));
  const body = await response.json();
  assert.ok(body.error);
  assert.equal(body.data, undefined);
  const post = await page.request.post(base + "/api/schedule", {
    headers: { origin: "https://untrusted.example" },
    data: { action: "save" },
  });
  assert.equal(post.status(), 403);
  const sameOrigin = await page.request.post(base + "/api/schedule", {
    headers: { origin: new URL(base).origin },
    data: { action: "save", revision: 0, data: {} },
  });
  assert.ok([400, 401, 403, 503].includes(sameOrigin.status()));
  const message = await sameOrigin.json();
  assert.notEqual(message.error, "Same-origin request required.");
  await page.goto(
    base +
      "/auth/confirm?token_hash=invalid&type=unknown&next=https://untrusted.example",
  );
  assert.equal(new URL(page.url()).origin, new URL(base).origin);
  assert.match(new URL(page.url()).pathname, /login/);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: anonymous team/account redirects, no unauthenticated schedule data, cross-origin writes denied, invite redirect cannot escape to an arbitrary origin. Actual sign-in/invite flows remain unrun without a Supabase project.",
  );
} finally {
  await browser.close();
}
