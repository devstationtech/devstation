/**
 * @Given the source files of the auth bounded context
 * @When  the import graph is resolved
 * @Then  no rule below may be violated.
 *
 * Each layer declares positively what it may import. Anything outside the
 * allow list — including other layers of this BC, other BCs, and any
 * non-shared project code — is a violation.
 */
import { arch } from "@arch-test-ts/mod.ts";

arch.configure({ root: new URL("../../../", import.meta.url) });

arch("auth/domain")
  .expect("server/src/auth/domain/**")
  .toOnlyImport(["server/src/auth/domain/**", "server/src/shared/**"]);

arch("auth/application")
  .expect("server/src/auth/application/**")
  .toOnlyImport([
    "server/src/auth/domain/**",
    "server/src/auth/application/**",
    "server/src/shared/**",
  ]);

arch("auth/inbound")
  .expect("server/src/auth/inbound/**")
  .toOnlyImport([
    "server/src/auth/domain/**",
    "server/src/auth/application/**",
    "server/src/auth/inbound/**",
    "server/src/shared/**",
    "libs/jsonrpc-contracts-ts/**",
  ])
  .ignoring({
    from: "server/src/auth/inbound/policies/**",
    to: "server/src/*/domain/events/**",
    reason: "policies translate foreign events into local commands",
  });

arch("auth/outbound")
  .expect("server/src/auth/outbound/**")
  .toOnlyImport([
    "server/src/auth/domain/**",
    "server/src/auth/application/**",
    "server/src/auth/outbound/**",
    "server/src/shared/**",
  ]);
