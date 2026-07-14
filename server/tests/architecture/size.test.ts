/**
 * @Given the source files of the size bounded context
 * @When  the import graph is resolved
 * @Then  no rule below may be violated.
 */
import { arch } from "@arch-test-ts/mod.ts";

arch.configure({ root: new URL("../../../", import.meta.url) });

arch("size/domain")
  .expect("server/src/size/domain/**")
  .toOnlyImport(["server/src/size/domain/**", "server/src/shared/**"]);

arch("size/application")
  .expect("server/src/size/application/**")
  .toOnlyImport([
    "server/src/size/domain/**",
    "server/src/size/application/**",
    "server/src/shared/**",
  ]);

arch("size/inbound")
  .expect("server/src/size/inbound/**")
  .toOnlyImport([
    "server/src/size/domain/**",
    "server/src/size/application/**",
    "server/src/size/inbound/**",
    "server/src/shared/**",
    "libs/jsonrpc-contracts-ts/**",
  ])
  .ignoring({
    from: "server/src/size/inbound/policies/**",
    to: "server/src/*/domain/events/**",
    reason: "policies translate foreign events into local commands",
  });

arch("size/outbound")
  .expect("server/src/size/outbound/**")
  .toOnlyImport([
    "server/src/size/domain/**",
    "server/src/size/application/**",
    "server/src/size/outbound/**",
    "server/src/shared/**",
  ]);
