/**
 * OpenRPC → TypeScript codegen for `@jsonrpc-contracts`.
 *
 * Reads every `*.openrpc.json` from `@jsonrpc-schemas/` and produces one
 * `<schema>.gen.ts` per schema in this package: each file contains the
 * shared classes/types declared in that schema's components plus one
 * `<Method>Request`/`<Method>Response` pair per declared method.
 *
 * Per-schema files keep the names short and local (Log, Step, etc. in
 * executions.gen.ts; NodePlanSucceededV1 etc. in cluster.gen.ts) so
 * adapters can `import { Log } from "@jsonrpc-contracts-ts/executions.gen.ts"`
 * without prefix verbosity, while still avoiding cross-BC collisions
 * via separate module namespaces.
 *
 * Why custom (instead of `@open-rpc/typings`):
 *   The official tooling emits client-shaped function types and synthetic
 *   hash names for schemas without a `title`. Our endpoints want struct
 *   types with semantic names — one Request/Response pair per method —
 *   so the official codegen mismatches our consumer shape. Migrate to
 *   `json-schema-to-typescript` (or the JSR equivalent) when a schema
 *   feature we don't support appears (oneOf/allOf/anyOf, recursive types).
 *
 * Supported subset:
 *   - JSON Schema: object/string/number/boolean/array/integer.
 *   - `$ref` resolved to `#/components/schemas/<Name>`.
 *   - `required`, `enum`, `format` (kept as plain string + JSDoc).
 *   - Nothing else (no oneOf/allOf/anyOf/patternProperties/conditionals).
 *
 * Run with: deno task contracts:codegen
 */
import { expandGlob } from "@std/fs/expand-glob";
import { fromFileUrl, relative } from "@std/path";

const PACKAGE_ROOT = fromFileUrl(new URL("./", import.meta.url));
const PROJECT_ROOT = fromFileUrl(new URL("../../../", import.meta.url));
const SCHEMAS_ROOT = fromFileUrl(new URL("../../jsonrpc-schemas/", import.meta.url));

interface OpenRpcDoc {
  openrpc: string;
  info: { title: string; version: string; description?: string };
  methods: OpenRpcMethod[];
  components?: { schemas?: Record<string, JsonSchema> };
}

interface OpenRpcMethod {
  name: string;
  description?: string;
  params: { name: string; description?: string; required?: boolean; schema: JsonSchema }[];
  result: { name: string; description?: string; schema: JsonSchema };
  errors?: { code: number; message: string }[];
}

type ScalarType = "object" | "string" | "number" | "boolean" | "array" | "integer" | "null";

interface JsonSchema {
  $ref?: string;
  type?: ScalarType | ScalarType[];
  description?: string;
  required?: string[];
  properties?: Record<string, JsonSchema>;
  additionalProperties?: JsonSchema | boolean;
  items?: JsonSchema;
  enum?: string[];
  format?: string;
  minLength?: number;
  oneOf?: JsonSchema[];
  discriminator?: { propertyName: string };
}

const main = async (): Promise<void> => {
  const entries: { name: string; doc: OpenRpcDoc }[] = [];
  for await (const entry of expandGlob("*.openrpc.json", { root: SCHEMAS_ROOT })) {
    const doc = JSON.parse(await Deno.readTextFile(entry.path)) as OpenRpcDoc;
    const base = entry.name.replace(/\.openrpc\.json$/, "");
    entries.push({ name: base, doc });
  }

  if (entries.length === 0) {
    console.error(`No *.openrpc.json files found under ${relative(PROJECT_ROOT, SCHEMAS_ROOT)}.`);
    Deno.exit(1);
  }

  // Global pool of every declared component across all schemas. Per-schema
  // files are self-contained: a schema that `$ref`s a component it does
  // not declare locally (e.g. the cross-cutting `Ack`) gets that component
  // emitted into its own .gen.ts, resolved from this pool. No cross-file
  // imports — each file stands alone for any language consuming it.
  const pool: Record<string, JsonSchema> = {};
  for (const { doc } of entries) {
    Object.assign(pool, doc.components?.schemas ?? {});
  }

  for (const { name, doc } of entries) {
    const target = `${PACKAGE_ROOT}${name}.gen.ts`;
    const output = generateForDoc(
      doc,
      pool,
      banner(`AUTO-GENERATED from @jsonrpc-schemas/${name}.openrpc.json`),
    );
    await Deno.writeTextFile(target, output);
    console.log(`✓ ${relative(PROJECT_ROOT, target)}`);
  }
};

/** Collects every `#/components/schemas/<Name>` referenced anywhere in a schema. */
const collectRefs = (schema: JsonSchema, acc: Set<string>): void => {
  if (schema.$ref) {
    const m = schema.$ref.match(/#\/components\/schemas\/(.+)$/);
    if (m) acc.add(m[1]);
  }
  if (schema.properties) {
    for (const prop of Object.values(schema.properties)) collectRefs(prop, acc);
  }
  if (schema.items) collectRefs(schema.items, acc);
  if (schema.oneOf) { for (const v of schema.oneOf) collectRefs(v, acc); }
  if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
    collectRefs(schema.additionalProperties, acc);
  }
};

const generateForDoc = (
  doc: OpenRpcDoc,
  pool: Record<string, JsonSchema>,
  header: string,
): string => {
  const local = doc.components?.schemas ?? {};

  // Transitively resolve referenced-but-not-declared components from the
  // global pool so the file is self-contained.
  const referenced = new Set<string>();
  for (const method of doc.methods) {
    for (const param of method.params) collectRefs(param.schema, referenced);
    collectRefs(method.result.schema, referenced);
  }
  for (const schema of Object.values(local)) collectRefs(schema, referenced);

  const extra: Record<string, JsonSchema> = {};
  const queue = [...referenced];
  while (queue.length > 0) {
    const ref = queue.pop()!;
    if (local[ref] || extra[ref]) continue;
    const fromPool = pool[ref];
    if (!fromPool) continue;
    extra[ref] = fromPool;
    const nested = new Set<string>();
    collectRefs(fromPool, nested);
    queue.push(...nested);
  }

  const blocks: string[] = [header];
  for (const [name, schema] of Object.entries({ ...local, ...extra })) {
    blocks.push(renderInterface(name, schema));
  }
  for (const method of doc.methods) {
    blocks.push(renderMethodRequest(method));
    blocks.push(renderMethodResponse(method));
  }
  return blocks.join("\n\n") + "\n";
};

const banner = (note: string): string =>
  `// ${note}\n// Do not edit by hand — run \`deno task contracts:codegen\`.`;

const renderInterface = (name: string, schema: JsonSchema): string => {
  if (schema.oneOf) {
    const desc = schema.description ? `/** ${schema.description} */\n` : "";
    return `${desc}export type ${name} = ${tsType(schema)};`;
  }
  if (schema.type !== "object" || !schema.properties) {
    return `export type ${name} = ${tsType(schema)};`;
  }
  return renderClass(name, schema);
};

/**
 * Emits a TypeScript class for an object schema.
 *
 * Properties whose schema is a single-value `enum` (e.g. discriminator
 * tags like `"type": { "enum": ["log"] }`) become class property
 * initializers — `readonly type = "log" as const` — baked in by the
 * constructor so `new ExecutionEventLog("hi")` produces an object that
 * is already in wire shape (no separate mapper needed).
 *
 * All other properties become constructor parameter properties. Required
 * properties come first; optional ones get the `?` modifier and trail
 * (TS constructor convention).
 */
const renderClass = (name: string, schema: JsonSchema): string => {
  const required = new Set(schema.required ?? []);
  const entries = Object.entries(schema.properties ?? {});

  const discriminators: [string, JsonSchema][] = [];
  const ctorReq: [string, JsonSchema][] = [];
  const ctorOpt: [string, JsonSchema][] = [];

  for (const [key, prop] of entries) {
    if (prop.enum && prop.enum.length === 1 && required.has(key)) {
      discriminators.push([key, prop]);
    } else if (required.has(key)) {
      ctorReq.push([key, prop]);
    } else {
      ctorOpt.push([key, prop]);
    }
  }

  const desc = schema.description ? `/** ${schema.description} */\n` : "";
  const discLines = discriminators.map(([key, prop]) => {
    const value = JSON.stringify(prop.enum![0]);
    return `  readonly ${key} = ${value} as const;`;
  });
  const ctorParams = [...ctorReq, ...ctorOpt].map(([key, prop]) => {
    const optional = required.has(key) ? "" : "?";
    const comment = prop.description ? `    /** ${prop.description} */\n` : "";
    return `${comment}    readonly ${key}${optional}: ${tsType(prop)},`;
  });

  if (ctorParams.length === 0) {
    return `${desc}export class ${name} {\n${discLines.join("\n")}\n}`;
  }
  const head = discLines.length > 0 ? `${discLines.join("\n")}\n\n` : "";
  return `${desc}export class ${name} {\n${head}  constructor(\n${
    ctorParams.join("\n")
  }\n  ) {}\n}`;
};

const renderMethodRequest = (method: OpenRpcMethod): string => {
  const typeName = `${methodTypeBase(method.name)}Request`;
  if (method.params.length === 0) {
    return `/** Request payload for \`${method.name}\`. */\nexport interface ${typeName} extends Record<string, never> {}`;
  }
  const lines = method.params.map((param) => {
    const optional = param.required === false ? "?" : "";
    const desc = param.description ?? param.schema.description;
    const comment = desc ? `  /** ${desc} */\n` : "";
    return `${comment}  readonly ${param.name}${optional}: ${tsType(param.schema)};`;
  });
  return `/** Request payload for \`${method.name}\`. */\nexport interface ${typeName} {\n${
    lines.join("\n")
  }\n}`;
};

const renderMethodResponse = (method: OpenRpcMethod): string => {
  const typeName = `${methodTypeBase(method.name)}Response`;
  return `/** Response payload of \`${method.name}\`. */\nexport type ${typeName} = ${
    tsType(method.result.schema)
  };`;
};

const methodTypeBase = (methodName: string): string =>
  methodName
    .split(/[.-]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");

const tsType = (schema: JsonSchema): string => {
  if (schema.$ref) {
    const match = schema.$ref.match(/#\/components\/schemas\/(.+)$/);
    if (!match) throw new Error(`Unsupported $ref: ${schema.$ref}`);
    return match[1];
  }
  if (schema.oneOf) {
    // Discriminated union — codegen produces a TS tagged union. The
    // `discriminator.propertyName` is informational only; TS narrows on
    // any literal-typed property, so we just emit the union of variants.
    return schema.oneOf.map((variant) => tsType(variant)).join(" | ");
  }
  if (schema.enum) return schema.enum.map((v) => JSON.stringify(v)).join(" | ");

  // Nullable: type: ["string", "null"] → string | null.
  if (Array.isArray(schema.type)) {
    const nullable = schema.type.includes("null");
    const others = schema.type.filter((t) => t !== "null");
    if (others.length === 0) return "null";
    const rendered = others.map((t) => tsType({ ...schema, type: t })).join(" | ");
    return nullable ? `${rendered} | null` : rendered;
  }

  switch (schema.type) {
    case "string":
      return "string";
    case "number":
    case "integer":
      return "number";
    case "boolean":
      return "boolean";
    case "array":
      return `ReadonlyArray<${tsType(schema.items ?? { type: "string" })}>`;
    case "object":
      if (schema.properties) return renderInlineObject(schema);
      if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
        return `Record<string, ${tsType(schema.additionalProperties)}>`;
      }
      return "Record<string, unknown>";
    case "null":
      return "null";
    default:
      return "unknown";
  }
};

const renderInlineObject = (schema: JsonSchema): string => {
  const required = new Set(schema.required ?? []);
  const lines = Object.entries(schema.properties ?? {}).map(([key, prop]) => {
    const optional = required.has(key) ? "" : "?";
    return `readonly ${key}${optional}: ${tsType(prop)}`;
  });
  return `{ ${lines.join("; ")} }`;
};

if (import.meta.main) await main();
