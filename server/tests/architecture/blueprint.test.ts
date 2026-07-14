/**
 * @Given the source files of the blueprint bounded context
 * @When  the import graph is resolved
 * @Then  no rule below may be violated.
 *
 * Each layer declares positively what it may import. Blueprint is the
 * canonical catalog — its query slice is allowed to read from the
 * blueprint BC's source.
 */
import { arch } from "@arch-test-ts/mod.ts";

arch.configure({ root: new URL("../../../", import.meta.url) });

arch("blueprint/domain")
  .expect("server/src/blueprint/domain/**")
  .toOnlyImport(["server/src/blueprint/domain/**", "server/src/shared/**"]);

arch("blueprint/application")
  .expect("server/src/blueprint/application/**")
  .toOnlyImport([
    "server/src/blueprint/**",
    "server/src/shared/**",
  ])
  .ignoring({
    from: "server/src/blueprint/application/queries/**",
    to: "server/src/blueprint/**",
    reason:
      "blueprint queries traverse the canonical catalog (blueprints.ts, index.ts) — blueprint IS the read model source",
  });

arch("blueprint/inbound")
  .expect("server/src/blueprint/inbound/**")
  .toOnlyImport([
    "server/src/blueprint/domain/**",
    "server/src/blueprint/application/**",
    "server/src/blueprint/inbound/**",
    "server/src/shared/**",
    "libs/jsonrpc-contracts-ts/**",
  ])
  .ignoring({
    from: "server/src/blueprint/inbound/policies/**",
    to: "server/src/*/domain/events/**",
    reason: "policies translate foreign events into local commands",
  });

arch("blueprint/outbound")
  .expect("server/src/blueprint/outbound/**")
  .toOnlyImport([
    "server/src/blueprint/domain/**",
    "server/src/blueprint/application/**",
    "server/src/blueprint/outbound/**",
    "server/src/shared/**",
  ]);
