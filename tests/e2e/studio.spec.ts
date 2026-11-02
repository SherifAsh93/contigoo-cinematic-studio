import { expect, test } from "@playwright/test";

test.beforeEach(async ({ request }) => {
  await request.get("http://127.0.0.1:8189/test/offline");
});

test("discovery loads without browser errors and never enables disconnected generation", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Make the extraordinary." })).toBeVisible();
  await page.getByRole("button", { name: "Create your first shot" }).click();
  await expect(page.getByRole("heading", { name: "Set the scene." })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Your vision" })).toHaveValue(/lone traveler/);
  await expect(page.locator(".generate-button")).toBeDisabled();
  await expect(page.getByText("Illustrated reference · no AI output yet")).toBeVisible();
  expect(errors).toEqual([]);
});

test("shot drafts persist after reload and reopen with their settings", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("textbox", { name: "Your vision" }).fill("An amber lighthouse in a winter storm");
  await page.getByRole("textbox", { name: "Project name" }).fill("Lighthouse film");
  await page.getByRole("combobox", { name: "Camera movement" }).selectOption("crane");
  await page.getByRole("button", { name: "Save shot to library" }).click();
  await expect(page.getByRole("heading", { name: "Every shot, a possibility." })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /My library/ }).click();
  const card = page.locator(".job-card").filter({ hasText: "Lighthouse film" }).first();
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Open shot" }).click();
  await expect(page.getByRole("textbox", { name: "Your vision" })).toHaveValue("An amber lighthouse in a winter storm");
  await expect(page.getByRole("combobox", { name: "Camera movement" })).toHaveValue("crane");
});

test("search, export and deletion work in the library", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("textbox", { name: "Your vision" }).fill("A shot to export and remove");
  const project = `Temporary ${Date.now()}`;
  await page.getByRole("textbox", { name: "Project name" }).fill(project);
  await page.getByRole("button", { name: "Save shot to library" }).click();
  await page.getByRole("textbox", { name: "Search library" }).fill(project);
  await expect(page.locator(".job-card")).toHaveCount(1);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export shot list" }).click();
  expect((await download).suggestedFilename()).toBe("contigoo-shot-list.json");
  page.on("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Delete shot" }).click();
  await expect(page.getByRole("heading", { name: "No matching shots." })).toBeVisible();
});

test("Arabic direction and preference survive reload", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Switch language" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { name: "ابتكر ما هو استثنائي." })).toBeVisible();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
});

test("mobile layout has no horizontal overflow and composer remains usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Make the extraordinary." })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("textbox", { name: "Your vision" }).fill("A cinematic mountain at dawn");
  await expect(page.getByRole("button", { name: "Save shot to library" })).toBeEnabled();
});

test("settings dialog supports keyboard dismissal", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Connect GPU worker" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText("COMFYUI_URL=http://127.0.0.1:8188")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
});

test("ComfyUI protocol: submit, poll, display and download output", async ({ page, request }) => {
  await request.get("http://127.0.0.1:8189/test/online");
  await page.goto("/");
  await page.locator(".mode-switch").getByRole("button", { name: "Image", exact: true }).click();
  await page.getByRole("textbox", { name: "Your vision" }).fill("A test lighthouse for the protocol fixture");
  await expect(page.locator(".generate-button")).toBeEnabled();
  await page.locator(".generate-button").click();
  await expect(page.getByText("Your vision is in the queue.")).toBeVisible();
  await expect(page.locator(".generated-preview img")).toBeVisible({ timeout: 15000 });
  const src = await page.locator(".generated-preview img").getAttribute("src");
  const media = await request.get(src!);
  expect(media.headers()["content-type"]).toBe("image/png");
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download original" }).click();
  expect((await download).suggestedFilename()).toBe("fixture.png");
});

test("API rejects invalid requests and cross-origin writes", async ({ request }) => {
  expect((await request.post("/api/jobs", { data: { prompt: "hello" } })).status()).toBe(400);
  expect((await request.post("/api/jobs", { data: "invalid JSON", headers: { "Content-Type": "application/json" } })).status()).toBe(400);
  expect((await request.post("/api/jobs", { data: {}, headers: { Origin: "https://other-site.example" } })).status()).toBe(403);
  expect((await request.get("/api/jobs/unknown-job")).status()).toBe(404);
  expect((await request.get("/api/media/unknown-job/0")).status()).toBe(404);
});
