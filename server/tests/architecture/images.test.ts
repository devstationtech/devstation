/**
 * @Given the source files of the images bounded context
 * @When  the import graph is resolved
 * @Then  no rule below may be violated.
 */
import { arch } from "@arch-test-ts/mod.ts";

arch.configure({ root: new URL("../../../", import.meta.url) });

arch("images/domain")
  .expect("server/src/images/domain/**")
  .toOnlyImport(["server/src/images/domain/**", "server/src/shared/**"]);

arch("images/application")
  .expect("server/src/images/application/**")
  .toOnlyImport([
    "server/src/images/domain/**",
    "server/src/images/application/**",
    "server/src/shared/**",
  ]);

arch("images/inbound")
  .expect("server/src/images/inbound/**")
  .toOnlyImport([
    "server/src/images/domain/**",
    "server/src/images/application/**",
    "server/src/images/inbound/**",
    "server/src/shared/**",
    "libs/jsonrpc-contracts-ts/**",
  ])
  .ignoring({
    from: "server/src/images/inbound/policies/**",
    to: "server/src/*/domain/events/**",
    reason: "policies translate foreign events into local commands",
  });

arch("images/outbound")
  .expect("server/src/images/outbound/**")
  .toOnlyImport([
    "server/src/images/domain/**",
    "server/src/images/application/**",
    "server/src/images/outbound/**",
    "server/src/shared/**",
  ]);
