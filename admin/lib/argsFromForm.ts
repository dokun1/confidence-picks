// Form <-> tools/call arguments, derived from a tool's JSON Schema. Pure: no
// React, no Next, no network -- unit-tested under node --test.
//
// Conventions the form and this module agree on:
//   - a blank field is NOT sent (update_dues_settings changes only what you fill in)
//   - the literal marker NULL_MARKER sends null, allowed only for nullable fields
//   - booleans are a tri-state select: "" | "true" | "false"
//   - arrays and objects are typed as JSON in a textarea

export const NULL_MARKER = "__null__";

export type FieldKind = "string" | "number" | "boolean" | "json";

export interface FieldSpec {
  name: string;
  kind: FieldKind;
  nullable: boolean;
  required: boolean;
  enum: string[] | undefined;
  description: string | undefined;
}

interface JsonSchemaProp {
  type?: string | string[];
  enum?: string[];
  description?: string;
}
export interface JsonSchemaObject {
  type?: string;
  properties?: Record<string, JsonSchemaProp>;
  required?: string[];
}

function kindOf(types: string[]): FieldKind {
  const t = types.filter((x) => x !== "null");
  if (t.includes("array") || t.includes("object")) return "json";
  if (t.includes("boolean")) return "boolean";
  if (t.includes("number") || t.includes("integer")) return "number";
  return "string";
}

export function fieldSpecs(schema: JsonSchemaObject): FieldSpec[] {
  const required = new Set(schema.required ?? []);
  return Object.entries(schema.properties ?? {}).map(([name, p]) => {
    const types = Array.isArray(p.type) ? p.type : p.type ? [p.type] : ["string"];
    return {
      name,
      kind: kindOf(types),
      nullable: types.includes("null"),
      required: required.has(name),
      enum: p.enum,
      description: p.description,
    };
  });
}

export function argsFromForm(
  schema: JsonSchemaObject,
  fd: FormData,
): { args: Record<string, unknown>; errors: string[] } {
  const args: Record<string, unknown> = {};
  const errors: string[] = [];

  for (const spec of fieldSpecs(schema)) {
    const raw = fd.get(spec.name);
    const text = typeof raw === "string" ? raw.trim() : "";

    if (text === "") {
      if (spec.required) errors.push(`${spec.name} is required`);
      continue;
    }
    if (text === NULL_MARKER) {
      if (!spec.nullable) errors.push(`${spec.name} cannot be null`);
      else args[spec.name] = null;
      continue;
    }

    switch (spec.kind) {
      case "number": {
        const n = Number(text);
        if (!Number.isFinite(n)) errors.push(`${spec.name} must be a number`);
        else args[spec.name] = n;
        break;
      }
      case "boolean": {
        if (text === "true") args[spec.name] = true;
        else if (text === "false") args[spec.name] = false;
        else errors.push(`${spec.name} must be true or false`);
        break;
      }
      case "json": {
        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch {
          errors.push(`${spec.name} must be valid JSON`);
          break;
        }
        const prop = schema.properties?.[spec.name];
        const types = Array.isArray(prop?.type) ? prop.type : prop?.type ? [prop.type] : [];
        if (types.includes("array") && !Array.isArray(parsed)) errors.push(`${spec.name} must be a JSON array`);
        else args[spec.name] = parsed;
        break;
      }
      default: {
        if (spec.enum && !spec.enum.includes(text)) errors.push(`${spec.name} must be one of ${spec.enum.join(", ")}`);
        else args[spec.name] = text;
      }
    }
  }
  return { args, errors };
}
