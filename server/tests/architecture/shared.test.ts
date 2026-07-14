/**
 * @Given the source files of src/shared/
 * @When  the import graph is resolved
 * @Then  shared follows the same hexagonal layering as BCs AND does not
 *        reach into any bounded context.
 *
 * Layout: `src/shared/building-blocks/` is the kernel of DDD tactical
 * primitives, organized as its own hexagonal slice mirroring a BC.
 * `domain/models/` holds Aggregate, Entity, the ValueObject marker, and
 * cross-BC VOs like Instant/Uuid/Vault/Secret/Credential. `domain/events/`
 * holds the event primitives DomainEvent/EventBag/EventId/Topic/Type as
 * a sibling of `models/` (same convention as BCs). `domain/ports/`
 * exposes the event bus ports under `events/outbound/`.
 *
 * Each cross-cutting concern lives in its own sub-BC under `shared/`,
 * mirroring the hexagonal layering: `domain/ports/outbound/` for the
 * port, `outbound/` for the adapter.
 *
 *  - `shared/authentication/` — Authentication + SessionResolver ports
 *    and adapters; Unauthenticated exception.
 *  - `shared/executions/` — full BC slice for long-running Execution
 *    primitive (Execution, ExecutionId, Task, generic event types).
 *  - `shared/secrets/` — SecretResolver port + adapter.
 *  - `shared/observability/` — Logger port + FileLogger adapter.
 *  - `shared/process/` — Process port + DenoCommand adapter.
 *  - `shared/file-system/` — FileSystem concrete adapter (no port).
 *  - `shared/http/` — HTTP client adapter.
 *  - `shared/ssh/` — SSH adapter (+ wait-for-ready, cli).
 *
 * Some legacy "bridge adapters" implement a shared port by delegating to
 * a BC's inbound action. The correct home is the BC itself (BC implements
 * the shared port). Until that refactor, the couplings are declared as
 * named exceptions so they stay visible.
 */
import { arch } from "@arch-test-ts/mod.ts";

arch.configure({ root: new URL("../../../", import.meta.url) });

arch("shared/building-blocks/domain")
  .expect("server/src/shared/building-blocks/domain/**")
  .toOnlyImport(["server/src/shared/building-blocks/domain/**"]);

arch("shared/building-blocks/outbound")
  .expect("server/src/shared/building-blocks/outbound/**")
  .toOnlyImport([
    "server/src/shared/building-blocks/**",
    "server/src/shared/observability/domain/**",
  ]);

arch("shared/inbound")
  .expect("server/src/shared/inbound/**")
  .toOnlyImport([
    "server/src/shared/building-blocks/**",
    "server/src/shared/inbound/**",
    "server/src/shared/authentication/domain/**",
    "server/src/shared/observability/domain/**",
  ]);

// The execution event vocabulary is schema-canonical: the Log/Step/
// Succeeded/Failed/Cancelled classes are codegen'd from
// executions.openrpc.json into @jsonrpc-contracts. Domain re-exports
// the union and the terminal helper from there — the contracts package
// is a dependency-free leaf (see contracts.test.ts), so consuming it
// from the domain layer does not violate the dependency rule.
arch("shared/executions/domain")
  .expect("server/src/shared/executions/domain/**")
  .toOnlyImport([
    "server/src/shared/building-blocks/**",
    "server/src/shared/executions/domain/**",
    "libs/jsonrpc-contracts-ts/**",
  ]);

arch("shared/executions/application")
  .expect("server/src/shared/executions/application/**")
  .toOnlyImport([
    "server/src/shared/building-blocks/**",
    "server/src/shared/executions/domain/**",
    "server/src/shared/executions/application/**",
    "libs/jsonrpc-contracts-ts/**",
  ]);

arch("shared/executions/inbound")
  .expect("server/src/shared/executions/inbound/**")
  .toOnlyImport([
    "server/src/shared/building-blocks/**",
    "server/src/shared/inbound/**",
    "server/src/shared/executions/domain/**",
    "server/src/shared/executions/application/**",
    "server/src/shared/executions/inbound/**",
    "libs/jsonrpc-contracts-ts/**",
  ]);

arch("shared/executions/outbound")
  .expect("server/src/shared/executions/outbound/**")
  .toOnlyImport([
    "server/src/shared/building-blocks/**",
    "server/src/shared/executions/domain/**",
    "server/src/shared/executions/outbound/**",
    "libs/jsonrpc-contracts-ts/**",
  ]);

arch("shared/http/outbound")
  .expect("server/src/shared/http/outbound/**")
  .toOnlyImport([
    "server/src/shared/building-blocks/**",
    "server/src/shared/observability/domain/**",
    "server/src/shared/process/domain/**",
    "server/src/shared/file-system/outbound/**",
    "server/src/shared/http/outbound/**",
  ]);

arch("shared/ssh/outbound")
  .expect("server/src/shared/ssh/outbound/**")
  .toOnlyImport([
    "server/src/shared/building-blocks/**",
    "server/src/shared/observability/domain/**",
    "server/src/shared/process/domain/**",
    "server/src/shared/file-system/outbound/**",
    "server/src/shared/ssh/outbound/**",
  ])
  .ignoring([
    {
      from: "server/src/shared/ssh/outbound/adapter.ts",
      to: "server/src/blueprint/index.ts",
      reason:
        "Ssh and ExecResult contracts re-exported from blueprint — should live in shared (interface used by both SSH adapter and blueprint step contracts)",
    },
    {
      from: "server/src/shared/ssh/outbound/adapter.ts",
      to: "server/src/blueprint/contracts/**",
      reason: "transitive: same Ssh/ExecResult coupling as above",
    },
  ]);

arch("shared/authentication/domain")
  .expect("server/src/shared/authentication/domain/**")
  .toOnlyImport([
    "server/src/shared/building-blocks/**",
    "server/src/shared/authentication/domain/**",
  ]);

arch("shared/authentication/outbound")
  .expect("server/src/shared/authentication/outbound/**")
  .toOnlyImport([
    "server/src/shared/building-blocks/**",
    "server/src/shared/authentication/domain/**",
  ])
  .ignoring([
    {
      from: "server/src/shared/authentication/outbound/session-resolver-adapter.ts",
      to: "server/src/auth/application/handlers/retrieve-session-handler.ts",
      reason:
        "bridge adapter calling auth's RetrieveSessionHandler directly — should be relocated to src/auth/outbound/",
    },
    {
      from: "server/src/shared/authentication/outbound/authentication-adapter.ts",
      to: "server/src/auth/domain/ports/outbound/sessions.ts",
      reason:
        "bridge adapter validating session ids via auth's Sessions port — should be relocated to src/auth/outbound/",
    },
  ]);

arch("shared/secrets/domain")
  .expect("server/src/shared/secrets/domain/**")
  .toOnlyImport([
    "server/src/shared/building-blocks/**",
    "server/src/shared/secrets/domain/**",
  ]);

arch("shared/secrets/outbound")
  .expect("server/src/shared/secrets/outbound/**")
  .toOnlyImport([
    "server/src/shared/building-blocks/**",
    "server/src/shared/secrets/domain/**",
    "server/src/shared/authentication/domain/**",
  ])
  .ignoring([
    {
      from: "server/src/shared/secrets/outbound/secret-resolver-adapter.ts",
      to: "server/src/vault/application/handlers/retrieve-secret-handler.ts",
      reason:
        "bridge adapter calling vault's RetrieveSecretHandler directly for in-process consumers (cluster provisioning, station install) — should be relocated to src/vault/outbound/",
    },
    {
      from: "server/src/shared/secrets/outbound/secret-resolver-adapter.ts",
      to: "server/src/vault/application/commands/retrieve-secret.ts",
      reason: "same bridge as above — uses vault's Command type",
    },
  ]);

arch("shared/observability/domain")
  .expect("server/src/shared/observability/domain/**")
  .toOnlyImport([
    "server/src/shared/building-blocks/**",
    "server/src/shared/observability/domain/**",
  ]);

arch("shared/observability/outbound")
  .expect("server/src/shared/observability/outbound/**")
  .toOnlyImport([
    "server/src/shared/building-blocks/**",
    "server/src/shared/observability/domain/**",
    "server/src/shared/file-system/outbound/**",
  ]);

arch("shared/process/domain")
  .expect("server/src/shared/process/domain/**")
  .toOnlyImport([
    "server/src/shared/building-blocks/**",
    "server/src/shared/process/domain/**",
  ]);

arch("shared/process/outbound")
  .expect("server/src/shared/process/outbound/**")
  .toOnlyImport([
    "server/src/shared/building-blocks/**",
    "server/src/shared/process/domain/**",
  ]);

arch("shared/file-system/outbound")
  .expect("server/src/shared/file-system/outbound/**")
  .toOnlyImport(["server/src/shared/building-blocks/**"]);
