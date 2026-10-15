import { ADMIN_PASSWORD, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "../support/constants.ts";
import { expect, loginRequest, test } from "../support/fixtures.ts";
import { newAnonymousClient } from "../support/session.ts";
import { alerts } from "../support/ui.ts";

const WRONG_PASSWORD = "definitely-not-the-password";
const FAILURES_BEFORE_BLOCK = 5;

const attemptLogin = (client: Awaited<ReturnType<typeof newAnonymousClient>>, headers: Record<string, string>) =>
  client.post("/api/auth/login", { data: { password: WRONG_PASSWORD }, headers });

test.describe("login rate limiting", () => {
  test("five failed logins block the address even when X-Forwarded-For is forged", async ({
    playwright,
    baseURL,
    clientIp,
  }) => {
    const client = await newAnonymousClient(playwright, baseURL as string);
    const statuses: number[] = [];
    for (let attempt = 0; attempt < FAILURES_BEFORE_BLOCK + 3; attempt += 1) {
      const response = await attemptLogin(client, {
        "x-real-ip": clientIp,
        "x-forwarded-for": `203.0.113.${attempt + 1}, 198.51.100.${attempt + 1}`,
      });
      statuses.push(response.status());
    }
    expect(statuses).toEqual([401, 401, 401, 401, 401, 429, 429, 429]);

    const blocked = await client.post("/api/auth/login", {
      data: { password: ADMIN_PASSWORD },
      headers: { "x-real-ip": clientIp, "x-forwarded-for": "192.0.2.250" },
    });
    expect(blocked.status()).toBe(429);
    expect(Number(blocked.headers()["retry-after"])).toBeGreaterThan(0);
    expect((await blocked.json()) as { error: string }).toEqual({
      error: "Too many login attempts. Please try again later.",
    });
    await client.dispose();
  });

  test("rotating forged leading X-Forwarded-For entries cannot escape the limit of the last hop", async ({
    playwright,
    baseURL,
    clientIp,
  }) => {
    const client = await newAnonymousClient(playwright, baseURL as string);
    const lastHop = clientIp.replace(/^10\./, "172.31.");
    const statuses: number[] = [];
    for (let attempt = 0; attempt < FAILURES_BEFORE_BLOCK + 2; attempt += 1) {
      const response = await attemptLogin(client, {
        "x-forwarded-for": `198.18.${attempt}.${attempt + 1}, 198.19.${attempt}.9, ${lastHop}`,
      });
      statuses.push(response.status());
    }
    expect(statuses).toEqual([401, 401, 401, 401, 401, 429, 429]);
    await client.dispose();
  });

  test("a blocked address does not block other addresses", async ({ playwright, baseURL, clientIp }) => {
    const client = await newAnonymousClient(playwright, baseURL as string);
    for (let attempt = 0; attempt < FAILURES_BEFORE_BLOCK; attempt += 1) {
      await attemptLogin(client, { "x-real-ip": clientIp });
    }
    expect((await attemptLogin(client, { "x-real-ip": clientIp })).status()).toBe(429);

    const other = clientIp.replace(/\.(\d+)$/, ".251");
    const response = await client.post("/api/auth/login", {
      data: { password: ADMIN_PASSWORD },
      headers: { "x-real-ip": other },
    });
    expect(response.status()).toBe(200);
    await client.dispose();
  });

  test("a successful login clears the failed attempts of that address", async ({ playwright, baseURL, clientIp }) => {
    const client = await newAnonymousClient(playwright, baseURL as string, { "x-real-ip": clientIp });
    for (let attempt = 0; attempt < FAILURES_BEFORE_BLOCK - 1; attempt += 1) {
      expect((await attemptLogin(client, {})).status()).toBe(401);
    }
    expect((await loginRequest(client)).status()).toBe(200);
    for (let attempt = 0; attempt < FAILURES_BEFORE_BLOCK - 1; attempt += 1) {
      expect((await attemptLogin(client, {})).status()).toBe(401);
    }
    await client.dispose();
  });
});

test.describe("login and session", () => {
  test("a wrong password shows the invalid password message and sets no session", async ({ page, context }) => {
    await page.goto("/auth/login");
    await page.getByLabel("Password").fill(WRONG_PASSWORD);
    await page.getByRole("button", { name: "Login" }).click();
    await expect(alerts(page)).toHaveText("Invalid password");
    await expect(page).toHaveURL(/\/auth\/login$/);
    expect(await context.cookies()).toEqual([]);
    await expect(page.getByLabel("Password")).toHaveAttribute("aria-invalid", "true");
  });

  test("the session cookie is httpOnly, strict, secure, rooted and lives twelve hours", async ({ request }) => {
    const response = await loginRequest(request);
    expect(response.status()).toBe(200);
    const header = response.headersArray().find((entry) => entry.name.toLowerCase() === "set-cookie")?.value ?? "";
    const [pair, ...attributes] = header.split(";").map((part) => part.trim());
    expect(pair?.startsWith(`${SESSION_COOKIE}=`)).toBe(true);
    expect(pair?.split("=")[1]?.split(".")).toHaveLength(3);
    const flags = attributes.map((attribute) => attribute.toLowerCase());
    expect(flags).toContain("httponly");
    expect(flags).toContain("secure");
    expect(flags).toContain("samesite=strict");
    expect(flags).toContain("path=/");
    expect(flags).toContain(`max-age=${SESSION_MAX_AGE_SECONDS}`);
  });

  test("a missing password is a bad request and a wrong one is unauthorized", async ({ request }) => {
    const missing = await request.post("/api/auth/login", { data: {} });
    expect(missing.status()).toBe(400);
    const wrong = await request.post("/api/auth/login", { data: { password: WRONG_PASSWORD } });
    expect(wrong.status()).toBe(401);
    expect(await wrong.json()).toEqual({ error: "Invalid password" });
  });

  test("logout revokes the session token on the server, not just in the browser", async ({
    playwright,
    baseURL,
    clientIp,
  }) => {
    const issuer = await newAnonymousClient(playwright, baseURL as string, { "x-real-ip": clientIp });
    const login = await loginRequest(issuer);
    expect(login.ok()).toBe(true);
    const setCookie = login.headersArray().find((entry) => entry.name.toLowerCase() === "set-cookie")?.value ?? "";
    const token = new RegExp(`${SESSION_COOKIE}=([^;]+)`).exec(setCookie)?.[1] ?? "";
    expect(token).not.toBe("");
    await issuer.dispose();

    const holder = await newAnonymousClient(playwright, baseURL as string, {
      "x-real-ip": clientIp,
      cookie: `${SESSION_COOKIE}=${token}`,
    });

    expect(await (await holder.get("/api/auth/status")).json()).toEqual({ isAdmin: true });
    expect((await holder.get("/admin/entries", { maxRedirects: 0 })).status()).toBe(200);

    const logout = await holder.post("/api/auth/logout", { maxRedirects: 0 });
    expect(logout.status()).toBe(303);
    expect(logout.headers().location).toBe("/auth/login");
    const cleared = logout.headersArray().find((entry) => entry.name.toLowerCase() === "set-cookie")?.value ?? "";
    expect(cleared.toLowerCase()).toContain("max-age=0");

    expect(await (await holder.get("/api/auth/status")).json()).toEqual({ isAdmin: false });
    expect((await holder.get("/admin/entries", { maxRedirects: 0 })).status()).toBe(307);
    await holder.dispose();
  });

  test("logging out in the browser returns to the login page and closes the admin area", async ({ adminPage }) => {
    await adminPage.goto("/");
    await adminPage.getByRole("button", { name: "Logout" }).click();
    await expect(adminPage).toHaveURL(/\/auth\/login$/);
    await adminPage.goto("/admin/entries");
    await expect(adminPage).toHaveURL(/\/auth\/login\?next=%2Fadmin%2Fentries$/);
  });
});
