/**
 * @Given the source files under libs/jsonrpc-client-ts/
 * @When  the import graph is resolved
 * @Then  the package stays generic — nothing project-specific.
 *
 * `jsonrpc-client-ts` is the transport layer. It must not know about
 * this project's BCs, the engine, the UI, or the contracts/schemas
 * built on top of it. This rule is what lets the package be lifted
 * out to its own repo (or republished to JSR) without rewrites.
 */
import { arch } from "@arch-test-ts/mod.ts";

arch.configure({ root: new URL("../../../../", import.meta.url) });

arch("jsonrpc-client is fully generic — no engine, no UI, no sibling libs")
  .expect("libs/jsonrpc-client-ts/**")
  .toNotImport([
    "server/src/**",
    "tui/ink/src/**",
    "libs/jsonrpc-contracts-ts/**",
    "libs/jsonrpc-schemas/**",
    "libs/mcp-test-harness-ts/**",
  ]);
