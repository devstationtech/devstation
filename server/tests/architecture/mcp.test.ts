/**
 * Architecture test for the MCP inbound surface. The shared MCP
 * surface contains only protocol shapes (`endpoint/`, `resource/`,
 * `policy/`, `prompts/`, `rpc-version/`, `server.ts`). Every dispatch
 * is handler-direct from a per-BC adapter.
 *
 * The MCP inbound surface has two distinct pieces with two distinct
 * coupling rules:
 *
 *  - `src/shared/inbound/mcp/` is the protocol-level adapter (server
 *    boot, registry, endpoint shape, policy, prompts). It must NOT
 *    reach into any BC's application/domain — it only knows the
 *    `Endpoint` interface from its own folder.
 *
 *  - `src/<bc>/inbound/mcp/<m>/endpoint.ts` is the BC-level adapter.
 *    It imports the protocol-level types from `src/shared/inbound/mcp/`
 *    AND the BC's own handlers/queries/commands — but NEVER another
 *    BC's internals.
 *
 * Cross-BC MCP coupling stays forbidden in both directions.
 */
import { arch } from "@arch-test-ts/mod.ts";

arch.configure({ root: new URL("../../../", import.meta.url) });

// Each BC may import the MCP protocol shapes ONLY from inside its own
// `inbound/mcp/` adapter. Domain/application/outbound must remain
// MCP-agnostic.
for (const bc of ["auth", "blueprint", "cluster", "size", "station", "vault"]) {
  arch(`${bc}/domain does not import the MCP inbound adapter`)
    .expect(`src/${bc}/domain/**`)
    .toNotImport(["server/src/shared/inbound/mcp/**"]);

  arch(`${bc}/application does not import the MCP inbound adapter`)
    .expect(`src/${bc}/application/**`)
    .toNotImport(["server/src/shared/inbound/mcp/**"]);

  arch(`${bc}/outbound does not import the MCP inbound adapter`)
    .expect(`src/${bc}/outbound/**`)
    .toNotImport(["server/src/shared/inbound/mcp/**"]);
}

// The shared MCP framework still cannot reach into any BC's internals.
arch("MCP protocol adapter does not import BC application/domain")
  .expect("server/src/shared/inbound/mcp/**")
  .toNotImport([
    "server/src/auth/application/**",
    "server/src/auth/domain/**",
    "server/src/blueprint/application/**",
    "server/src/blueprint/domain/**",
    "server/src/cluster/application/**",
    "server/src/cluster/domain/**",
    "server/src/size/application/**",
    "server/src/size/domain/**",
    "server/src/station/application/**",
    "server/src/station/domain/**",
    "server/src/vault/application/**",
    "server/src/vault/domain/**",
  ]);

// Cross-BC MCP coupling is forbidden: cluster's MCP adapter cannot
// import another BC's domain/application/outbound (and vice versa).
const BCS = ["auth", "blueprint", "cluster", "size", "station", "vault"];
for (const bc of BCS) {
  const others = BCS.filter((x) => x !== bc).flatMap((x) => [
    `src/${x}/application/**`,
    `src/${x}/domain/**`,
    `src/${x}/outbound/**`,
  ]);
  arch(`${bc}/inbound/mcp does not import other BC internals`)
    .expect(`src/${bc}/inbound/mcp/**`)
    .toNotImport(others);
}
