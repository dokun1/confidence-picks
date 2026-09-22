import { test, describe } from "node:test";
import assert from "node:assert";
import { guardDecision } from "../lib/authGuard.ts";

describe("guardDecision", () => {
  const req = (auth: unknown, href = "https://admin.confidence-picks.com/some/page?x=1") =>
    ({ auth, nextUrl: { origin: "https://admin.confidence-picks.com", href } });

  test("passes a request with a session", () => {
    assert.deepStrictEqual(guardDecision(req({ adminEmail: "a@b.c" })), { type: "next" });
  });

  test("redirects a request without one to /signin, carrying where it was going", () => {
    const d = guardDecision(req(null));
    assert.strictEqual(d.type, "redirect");
    const u = new URL((d as { location: string }).location);
    assert.strictEqual(u.origin + u.pathname, "https://admin.confidence-picks.com/signin");
    assert.strictEqual(u.searchParams.get("callbackUrl"), "https://admin.confidence-picks.com/some/page?x=1");
  });
});
