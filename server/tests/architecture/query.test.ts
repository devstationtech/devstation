/**
 * @Given the source files of every queries slice under src/<bc>/application/queries/
 * @When  the import graph is resolved
 * @Then  each slice may only import its own slice + src/shared/.
 *
 * Query slices are dedicated read models living inside each BC's application
 * layer. They are NOT permitted to consume the BC's own domain models or
 * outbound ports, nor any other BC's source code. The single sanctioned
 * exception is `blueprint`: its read model traverses its own BC source to
 * read the canonical catalog (Blueprints, Step, etc.).
 */
import { arch } from "@arch-test-ts/mod.ts";

arch.configure({ root: new URL("../../../", import.meta.url) });

arch("auth/application/queries")
  .expect("server/src/auth/application/queries/**")
  .toOnlyImport(["server/src/auth/application/queries/**", "server/src/shared/**"]);

arch("blueprint/application/queries")
  .expect("server/src/blueprint/application/queries/**")
  .toOnlyImport([
    "server/src/blueprint/application/queries/**",
    "server/src/blueprint/**",
    "server/src/shared/**",
  ]);

arch("cluster/application/queries")
  .expect("server/src/cluster/application/queries/**")
  .toOnlyImport(["server/src/cluster/application/queries/**", "server/src/shared/**"]);

arch("size/application/queries")
  .expect("server/src/size/application/queries/**")
  .toOnlyImport(["server/src/size/application/queries/**", "server/src/shared/**"]);

arch("shared/executions/application/queries")
  .expect("server/src/shared/executions/application/queries/**")
  .toOnlyImport([
    "server/src/shared/executions/application/queries/**",
    "server/src/shared/**",
  ]);

arch("station/application/queries")
  .expect("server/src/station/application/queries/**")
  .toOnlyImport(["server/src/station/application/queries/**", "server/src/shared/**"]);

arch("system/application/queries")
  .expect("server/src/system/application/queries/**")
  .toOnlyImport(["server/src/system/application/queries/**", "server/src/shared/**"]);

arch("vault/application/queries")
  .expect("server/src/vault/application/queries/**")
  .toOnlyImport(["server/src/vault/application/queries/**", "server/src/shared/**"]);

// Within cluster queries, generic reads (all/by-id/records) must not depend on
// provider-specific sub-slices. Provider knowledge belongs under proxmox/.
arch("cluster — generic reads ignore provider-specific slices")
  .expect([
    "server/src/cluster/application/queries/all/**",
    "server/src/cluster/application/queries/by-id/**",
    "server/src/cluster/application/queries/records/**",
  ])
  .toNotImport("server/src/cluster/application/queries/proxmox/**");
