import { expect, test } from "@playwright/test";

const baseUrl = process.env.ERP_URL;

test.describe("Cabeceras de seguridad CSP", () => {
  test.skip(!baseUrl, "ERP_URL no configurado; requiere servidor QA local o Preview autorizado.");

  test("usa nonce único por respuesta y no permite unsafe-inline en script-src", async ({ request }) => {
    const first = await request.get(baseUrl!);
    expect(first.ok()).toBeTruthy();

    const csp1 = first.headers()["content-security-policy"] || "";
    const scriptSrc1 = csp1.split(";").find((x) => x.trim().startsWith("script-src")) || "";
    const nonce1 = scriptSrc1.match(/'nonce-([^']+)'/)?.[1];

    expect(nonce1).toBeTruthy();
    expect(scriptSrc1).not.toContain("'unsafe-inline'");

    const html = await first.text();
    const tags = [...html.matchAll(/<script\b[^>]*>/gi)].map((x) => x[0]);
    expect(tags.length).toBeGreaterThan(0);
    for (const tag of tags) {
      expect(tag).toContain(`nonce="${nonce1}"`);
    }

    const second = await request.get(baseUrl!);
    expect(second.ok()).toBeTruthy();
    const csp2 = second.headers()["content-security-policy"] || "";
    const nonce2 = csp2.match(/'nonce-([^']+)'/)?.[1];

    expect(nonce2).toBeTruthy();
    expect(nonce2).not.toBe(nonce1);
  });
});
