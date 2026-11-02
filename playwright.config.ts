import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:3100", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    { command: "npx tsx tests/fixtures/comfy-server.ts", url: "http://127.0.0.1:8189/health", reuseExistingServer: false },
    { command: "npm run start -- --port 3100", url: "http://127.0.0.1:3100", reuseExistingServer: false, env: { COMFYUI_URL: "http://127.0.0.1:8189", STUDIO_DATA_DIR: ".data/e2e", STUDIO_WORKFLOWS: "workflows/profiles.json" } },
  ],
});
