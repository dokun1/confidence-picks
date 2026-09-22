import { test, describe } from "node:test";
import assert from "node:assert";
import { isEmailAllowed, serverAllowlistCheck } from "../lib/allowlist.ts";

// The allowlist is the portal's only authorization decision, so every way it
// can fail must fail CLOSED.

describe("isEmailAllowed", () => {
  test("allows only an explicit { allowed: true }", async () => {
    assert.strictEqual(await isEmailAllowed("a@b.c", async () => ({ allowed: true })), true);
    assert.strictEqual(await isEmailAllowed("a@b.c", async () => ({ allowed: false })), false);
    assert.strictEqual(await isEmailAllowed("a@b.c", async () => ({} as never)), false);
    assert.strictEqual(await isEmailAllowed("a@b.c", async () => ({ allowed: "true" } as never)), false);
  });

  test("denies an empty email without calling the check", async () => {
    let called = 0;
    const check = async () => { called++; return { allowed: true }; };
    assert.strictEqual(await isEmailAllowed("", check), false);
    assert.strictEqual(await isEmailAllowed(null, check), false);
    assert.strictEqual(await isEmailAllowed(undefined, check), false);
    assert.strictEqual(called, 0);
  });

  test("denies when the check throws", async () => {
    assert.strictEqual(await isEmailAllowed("a@b.c", async () => { throw new Error("network"); }), false);
  });
});

describe("serverAllowlistCheck", () => {
  const withEnv = async (env: Record<string, string | undefined>, fn: () => Promise<void>) => {
    const saved: Record<string, string | undefined> = {};
    for (const k of Object.keys(env)) { saved[k] = process.env[k]; if (env[k] === undefined) delete process.env[k]; else process.env[k] = env[k]; }
    try { await fn(); } finally { for (const k of Object.keys(env)) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } }
  };
  const withFetch = async (impl: typeof fetch, fn: () => Promise<void>) => {
    const real = globalThis.fetch; globalThis.fetch = impl;
    try { await fn(); } finally { globalThis.fetch = real; }
  };

  test("denies, without a request, when SERVER_API_URL or ADMIN_API_SECRET is unset", async () => {
    let called = 0;
    await withFetch((async () => { called++; return new Response("{}"); }) as typeof fetch, async () => {
      await withEnv({ SERVER_API_URL: undefined, ADMIN_API_SECRET: "s" }, async () => {
        assert.deepStrictEqual(await serverAllowlistCheck("a@b.c"), { allowed: false });
      });
      await withEnv({ SERVER_API_URL: "http://api", ADMIN_API_SECRET: undefined }, async () => {
        assert.deepStrictEqual(await serverAllowlistCheck("a@b.c"), { allowed: false });
      });
    });
    assert.strictEqual(called, 0);
  });

  test("sends the secret as a bearer to the backend's check endpoint, email encoded", async () => {
    let seen: { url: string; auth: string | null } | undefined;
    await withEnv({ SERVER_API_URL: "https://api.example.com/", ADMIN_API_SECRET: "sek" }, async () => {
      await withFetch((async (url: RequestInfo | URL, init?: RequestInit) => {
        seen = { url: String(url), auth: new Headers(init?.headers).get("authorization") };
        return new Response(JSON.stringify({ allowed: true }), { status: 200 });
      }) as typeof fetch, async () => {
        assert.deepStrictEqual(await serverAllowlistCheck("a+b@c.d"), { allowed: true });
      });
    });
    assert.strictEqual(seen?.url, "https://api.example.com/api/admin-portal/allowlist/check?email=a%2Bb%40c.d");
    assert.strictEqual(seen?.auth, "Bearer sek");
  });

  test("denies on a non-2xx response", async () => {
    await withEnv({ SERVER_API_URL: "http://api", ADMIN_API_SECRET: "sek" }, async () => {
      for (const status of [401, 403, 500, 503]) {
        await withFetch((async () => new Response(JSON.stringify({ allowed: true }), { status })) as typeof fetch, async () => {
          assert.deepStrictEqual(await serverAllowlistCheck("a@b.c"), { allowed: false }, String(status));
        });
      }
    });
  });
});
