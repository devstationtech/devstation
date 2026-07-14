/**
 * @Given the source files of the vault bounded context
 * @When  the import graph is resolved
 * @Then  no rule below may be violated.
 */
import { arch } from "@arch-test-ts/mod.ts";

arch.configure({ root: new URL("../../../", import.meta.url) });

arch("vault/domain")
  .expect("server/src/vault/domain/**")
  .toOnlyImport(["server/src/vault/domain/**", "server/src/shared/**"]);

arch("vault/application")
  .expect("server/src/vault/application/**")
  .toOnlyImport([
    "server/src/vault/domain/**",
    "server/src/vault/application/**",
    "server/src/shared/**",
  ]);

arch("vault/inbound")
  .expect("server/src/vault/inbound/**")
  .toOnlyImport([
    "server/src/vault/domain/**",
    "server/src/vault/application/**",
    "server/src/vault/inbound/**",
    "server/src/shared/**",
    "libs/jsonrpc-contracts-ts/**",
  ])
  .ignoring({
    from: "server/src/vault/inbound/policies/**",
    to: "server/src/*/domain/events/**",
    reason: "policies translate foreign events into local commands",
  });

arch("vault/outbound")
  .expect("server/src/vault/outbound/**")
  .toOnlyImport([
    "server/src/vault/domain/**",
    "server/src/vault/application/**",
    "server/src/vault/outbound/**",
    "server/src/shared/**",
  ]);
