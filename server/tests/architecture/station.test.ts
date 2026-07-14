/**
 * @Given the source files of the station bounded context
 * @When  the import graph is resolved
 * @Then  no rule below may be violated.
 *
 * Station owns the anti-corruption surface for blueprint: specific files
 * in the domain and outbound layers are explicitly authorized to consume
 * blueprint's published language.
 */
import { arch } from "@arch-test-ts/mod.ts";

arch.configure({ root: new URL("../../../", import.meta.url) });

arch("station/domain")
  .expect("server/src/station/domain/**")
  .toOnlyImport(["server/src/station/domain/**", "server/src/shared/**"])
  .ignoring([
    {
      from: "server/src/station/domain/contracts/blueprint.ts",
      to: "server/src/blueprint/**",
      reason: "re-export hub for blueprint's published language",
    },
    {
      from: "server/src/station/domain/ports/outbound/blueprints.ts",
      to: "server/src/blueprint/**",
      reason: "Blueprints port consumes blueprint types",
    },
  ]);

arch("station/application")
  .expect("server/src/station/application/**")
  .toOnlyImport([
    "server/src/station/domain/**",
    "server/src/station/application/**",
    "server/src/shared/**",
    "libs/jsonrpc-contracts-ts/**",
  ]);

arch("station/inbound")
  .expect("server/src/station/inbound/**")
  .toOnlyImport([
    "server/src/station/domain/**",
    "server/src/station/application/**",
    "server/src/station/inbound/**",
    "server/src/shared/**",
    "libs/jsonrpc-contracts-ts/**",
  ])
  .ignoring({
    from: "server/src/station/inbound/policies/**",
    to: "server/src/*/domain/events/**",
    reason: "policies translate foreign events into local commands",
  });

arch("station/outbound")
  .expect("server/src/station/outbound/**")
  .toOnlyImport([
    "server/src/station/domain/**",
    "server/src/station/application/**",
    "server/src/station/outbound/**",
    "server/src/shared/**",
    "libs/jsonrpc-contracts-ts/**",
  ])
  .ignoring([
    {
      from: "server/src/station/outbound/blueprints/**",
      to: "server/src/blueprint/**",
      reason: "anti-corruption adapter for blueprint",
    },
    {
      from: "server/src/station/outbound/installer/**",
      to: "server/src/blueprint/**",
      reason: "installer runtime consumes Step descriptor + Context interface",
    },
  ]);
