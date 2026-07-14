/**
 * @Given the source files of the cluster bounded context
 * @When  the import graph is resolved
 * @Then  no rule below may be violated.
 */
import { arch } from "@arch-test-ts/mod.ts";

arch.configure({ root: new URL("../../../", import.meta.url) });

arch("cluster/domain")
  .expect("server/src/cluster/domain/**")
  .toOnlyImport(["server/src/cluster/domain/**", "server/src/shared/**"]);

arch("cluster/application")
  .expect("server/src/cluster/application/**")
  .toOnlyImport([
    "server/src/cluster/domain/**",
    "server/src/cluster/application/**",
    "server/src/shared/**",
  ]);

arch("cluster/inbound")
  .expect("server/src/cluster/inbound/**")
  .toOnlyImport([
    "server/src/cluster/domain/**",
    "server/src/cluster/application/**",
    "server/src/cluster/inbound/**",
    "server/src/shared/**",
    "libs/jsonrpc-contracts-ts/**",
  ])
  .ignoring({
    from: "server/src/cluster/inbound/policies/**",
    to: "server/src/*/domain/events/**",
    reason: "policies translate foreign events into local commands",
  });

arch("cluster/outbound")
  .expect("server/src/cluster/outbound/**")
  .toOnlyImport([
    "server/src/cluster/domain/**",
    "server/src/cluster/application/**",
    "server/src/cluster/outbound/**",
    "server/src/shared/**",
    "libs/jsonrpc-contracts-ts/**",
  ]);
