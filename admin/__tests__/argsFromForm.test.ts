import { test, describe } from "node:test";
import assert from "node:assert";
import { argsFromForm, fieldSpecs } from "../lib/argsFromForm.ts";

// The inspector builds one form per tool from its JSON Schema and turns the
// submitted fields back into a tools/call argument object. The rules that
// matter: a blank field is NOT SENT (update_dues_settings relies on that to
// change only what you filled in), "null" is sent as null when the schema
// allows it, numbers are numbers, and arrays/objects come from a JSON textarea.

const schema = {
  type: "object",
  properties: {
    group: { type: "string" },
    enabled: { type: "boolean" },
    amount: { type: ["number", "null"] },
    week: { type: "number" },
    paymentMethod: { type: "string", enum: ["venmo", "cashapp", "other"] },
    members: { type: "array", items: { type: "number" } },
    picks: { type: "array", items: { type: "object" } },
    note: { type: ["string", "null"] },
  },
  required: ["group"],
};

const form = (entries: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
};

describe("fieldSpecs", () => {
  test("derives one spec per property with kind, nullability and requiredness", () => {
    const specs = fieldSpecs(schema);
    const by = Object.fromEntries(specs.map((s) => [s.name, s])) as Record<string, (typeof specs)[number]>;
    const get = (n: string) => { const f = by[n]; assert.ok(f, n); return f; };
    assert.deepStrictEqual(get("group"), { name: "group", kind: "string", nullable: false, required: true, enum: undefined, description: undefined });
    assert.strictEqual(get("enabled").kind, "boolean");
    assert.strictEqual(get("amount").kind, "number");
    assert.strictEqual(get("amount").nullable, true);
    assert.deepStrictEqual(get("paymentMethod").enum, ["venmo", "cashapp", "other"]);
    assert.strictEqual(get("members").kind, "json");
    assert.strictEqual(get("picks").kind, "json");
    assert.strictEqual(get("note").nullable, true);
  });
});

describe("argsFromForm", () => {
  test("omits blank fields entirely", () => {
    const { args, errors } = argsFromForm(schema, form({ group: "g", amount: "", week: "", note: "", members: "" }));
    assert.deepStrictEqual(errors, []);
    assert.deepStrictEqual(args, { group: "g" });
  });

  test("coerces numbers and rejects non-numbers", () => {
    assert.deepStrictEqual(argsFromForm(schema, form({ group: "g", week: "2", amount: "25.50" })).args, { group: "g", week: 2, amount: 25.5 });
    const { errors } = argsFromForm(schema, form({ group: "g", week: "two" }));
    assert.match(errors[0]!, /week/);
  });

  test("booleans come from a tri-state select: '', 'true', 'false'", () => {
    assert.deepStrictEqual(argsFromForm(schema, form({ group: "g", enabled: "true" })).args, { group: "g", enabled: true });
    assert.deepStrictEqual(argsFromForm(schema, form({ group: "g", enabled: "false" })).args, { group: "g", enabled: false });
    assert.deepStrictEqual(argsFromForm(schema, form({ group: "g", enabled: "" })).args, { group: "g" });
  });

  test("a __null__ marker sends null only where the schema allows it", () => {
    assert.deepStrictEqual(argsFromForm(schema, form({ group: "g", amount: "__null__", note: "__null__" })).args, { group: "g", amount: null, note: null });
    const { errors } = argsFromForm(schema, form({ group: "g", week: "__null__" }));
    assert.match(errors[0]!, /week.*null/i);
  });

  test("enum values pass through, others are rejected", () => {
    assert.deepStrictEqual(argsFromForm(schema, form({ group: "g", paymentMethod: "cashapp" })).args, { group: "g", paymentMethod: "cashapp" });
    assert.match(argsFromForm(schema, form({ group: "g", paymentMethod: "paypal" })).errors[0]!, /paymentMethod/);
  });

  test("arrays and objects are parsed from JSON, with a clear error when malformed", () => {
    const ok = argsFromForm(schema, form({ group: "g", members: "[3, 4]", picks: '[{"gameId":1,"pickedTeamId":"2","confidence":3}]' }));
    assert.deepStrictEqual(ok.args, { group: "g", members: [3, 4], picks: [{ gameId: 1, pickedTeamId: "2", confidence: 3 }] });
    const bad = argsFromForm(schema, form({ group: "g", members: "[3, 4" }));
    assert.match(bad.errors[0]!, /members.*JSON/i);
    const notArray = argsFromForm(schema, form({ group: "g", members: '{"a":1}' }));
    assert.match(notArray.errors[0]!, /members.*array/i);
  });

  test("a missing required field is an error", () => {
    assert.match(argsFromForm(schema, form({ week: "1" })).errors[0]!, /group.*required/i);
  });

  test("ignores form fields that are not in the schema", () => {
    assert.deepStrictEqual(argsFromForm(schema, form({ group: "g", token: "cp_live_x", __tool: "x" })).args, { group: "g" });
  });
});
