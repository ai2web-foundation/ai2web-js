// Minimal JSON-Schema-subset validator for action input schemas. Dependency-free and
// deliberately pragmatic: it covers the shapes AI2Web actions actually declare (objects
// with typed and required properties, primitives, arrays, enum) rather than the whole of
// JSON Schema. Used by @ai2web/server to validate incoming requests against the action's
// declared input_schema, so "schema compliance on each request" is built in, not DIY.

export interface SchemaResult {
  valid: boolean;
  errors: string[];
}

type Json = Record<string, unknown>;

function typeOf(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v; // object | string | number | boolean | undefined | function
}

/** Validate a value against a JSON-Schema-subset. Empty/absent schema accepts anything. */
export function validateSchema(value: unknown, schema: unknown, path = "input"): SchemaResult {
  const errors: string[] = [];
  const s = schema as Json | undefined;
  if (!s || typeof s !== "object" || Array.isArray(s) || Object.keys(s).length === 0) {
    return { valid: true, errors };
  }

  const declaredType = s.type as string | undefined;
  if (declaredType) {
    const t = typeOf(value);
    const ok = declaredType === "integer" ? t === "number" && Number.isInteger(value) : t === declaredType;
    if (!ok) {
      errors.push(`${path}: expected ${declaredType}, got ${t}`);
      return { valid: false, errors }; // wrong base type: no point checking deeper
    }
  }

  if (Array.isArray(s.enum) && !s.enum.some((e) => e === value)) {
    errors.push(`${path}: value is not one of the allowed options`);
  }

  const isObject = value !== null && typeof value === "object" && !Array.isArray(value);
  if ((declaredType === "object" || (!declaredType && isObject)) && isObject) {
    const obj = value as Json;
    const props = (s.properties as Json | undefined) ?? {};
    const required = (s.required as string[] | undefined) ?? [];
    for (const key of required) {
      if (!(key in obj)) errors.push(`${path}.${key}: required`);
    }
    for (const [key, sub] of Object.entries(props)) {
      if (key in obj) errors.push(...validateSchema(obj[key], sub, `${path}.${key}`).errors);
    }
  }

  if ((declaredType === "array" || (!declaredType && Array.isArray(value))) && Array.isArray(value) && s.items) {
    value.forEach((item, i) => errors.push(...validateSchema(item, s.items, `${path}[${i}]`).errors));
  }

  return { valid: errors.length === 0, errors };
}
