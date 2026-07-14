/**
 * @Given the source files under tui/ink/src/
 * @When  the import graph is resolved
 * @Then  no rule below may be violated.
 *
 * The Ink TUI talks to the engine over JSON-RPC/MCP via the
 * `devstation-server` subprocess. It must not pull a single line of
 * server code at compile time.
 *
 * One blanket rule expresses that invariant — every domain model,
 * port, application command/query, outbound adapter, `dependencies.ts`
 * and the in-process `rpc.ts` Server lives under `server/src/**` and
 * is therefore forbidden in one shot. A violation report names the
 * exact file → file edge, which is the layer label anyway.
 */
import { arch } from "@arch-test-ts/mod.ts";

arch.configure({ root: new URL("../../../../", import.meta.url) });

arch("ui is fully decoupled from the engine — talks to devstation-server via stdio")
  .expect("tui/ink/src/**")
  .toNotImport("server/src/**");

arch("cluster providers UI is only used by the cluster detail router")
  .expect("tui/ink/src/cluster/providers/**")
  .toOnlyBeImportedBy(
    ["tui/ink/src/cluster/detail.tsx", "tui/ink/src/cluster/providers/**"],
    { within: "tui/ink/src/" },
  );
