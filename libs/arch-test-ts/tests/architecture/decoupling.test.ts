/**
 * @Given the source files under libs/arch-test-ts/
 * @When  the import graph is resolved
 * @Then  the package is fully generic — knows nothing about this project.
 *
 * `arch-test-ts` is a Pest-inspired architectural assertion DSL. Any
 * dependency on the engine, the UI, or the sibling JSON-RPC libs would
 * defeat the package's purpose (and block its extraction to a standalone
 * repo). Meta-test: the lib uses itself to guard its own boundary.
 */
import { arch } from "@arch-test-ts/mod.ts";

arch.configure({ root: new URL("../../../../", import.meta.url) });

arch("arch-test-ts has no project-specific imports")
  .expect("libs/arch-test-ts/src/**")
  .toNotImport([
    "server/src/**",
    "tui/ink/src/**",
    "libs/jsonrpc-client-ts/**",
    "libs/jsonrpc-contracts-ts/**",
    "libs/mcp-test-harness-ts/**",
  ]);
