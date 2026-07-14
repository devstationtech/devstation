/**
 * @Given the source files under libs/jsonrpc-contracts-ts/
 * @When  the import graph is resolved
 * @Then  the package stays self-contained.
 *
 * `jsonrpc-contracts-ts` is the TypeScript materialization of the
 * `jsonrpc-schemas` OpenRPC contracts. It exists so consumers (engine,
 * UI, future Go/Electron clients via codegen) can import wire types
 * without reading the schemas at runtime. It must not import from the
 * engine or the UI — that would invert the dependency arrow.
 *
 * It does read `libs/jsonrpc-schemas/` at codegen time via a relative
 * path inside `codegen.ts` (no import alias), which is fine — that is
 * the source of truth feeding the generation.
 */
import { arch } from "@arch-test-ts/mod.ts";

arch.configure({ root: new URL("../../../../", import.meta.url) });

arch("jsonrpc-contracts stays self-contained — no engine or UI imports")
  .expect("libs/jsonrpc-contracts-ts/**")
  .toNotImport([
    "server/src/**",
    "tui/ink/src/**",
    "libs/mcp-test-harness-ts/**",
  ]);
