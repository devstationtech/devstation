import { assertEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { topoSort } from "@server/station/application/handlers/install-station-handler.ts";
import { Service } from "@server/station/domain/models/service/service.ts";
import { Id } from "@server/station/domain/models/service/id.ts";
import { Name } from "@server/station/domain/models/service/name.ts";
import { BlueprintName } from "@server/station/domain/models/service/blueprint-name.ts";
import { Vault } from "@server/shared/building-blocks/domain/models/value-objects/vault.ts";
import { Secret } from "@server/shared/building-blocks/domain/models/value-objects/secret.ts";
import { Secrets } from "@server/station/domain/models/service/secrets.ts";
import { Inputs } from "@server/station/domain/models/service/inputs.ts";
import { Instance } from "@server/station/domain/models/service/instance.ts";
import { Credential } from "@server/shared/building-blocks/domain/models/value-objects/credential.ts";
import { Role } from "@server/station/domain/models/service/role.ts";
import { Host } from "@server/station/domain/models/service/host.ts";
import { Creation } from "@server/shared/building-blocks/domain/models/value-objects/creation.ts";
import { User } from "@server/shared/building-blocks/domain/models/value-objects/user.ts";
import { Hostname } from "@server/shared/building-blocks/domain/models/value-objects/hostname.ts";

/**
 * `topoSort` orders a selected subset of services so a host is always
 * installed before anything hosted on it. It is the orchestration spine of
 * install (forward) and uninstall (reversed), so its ordering and its
 * circular-dependency guard are pinned here directly.
 */

const creation = () => Creation.now(new User("u"), new Hostname("h"));

function standalone(name: string): Service {
  return new Service(
    new Id(),
    new Name(name),
    new BlueprintName("docker"),
    new Vault(),
    new Inputs({}),
    new Secrets({}),
    [
      new Instance(
        new Role("main"),
        "10.0.0.1",
        new Credential(new Vault(), new Secret(), new Secret()),
      ),
    ],
    null,
    creation(),
  );
}

function hostedOn(name: string, hostServiceId: Id): Service {
  return new Service(
    new Id(),
    new Name(name),
    new BlueprintName("argocd"),
    new Vault(),
    new Inputs({}),
    new Secrets({}),
    [],
    new Host(hostServiceId, "main"),
    creation(),
  );
}

const indexOf = (out: Service[], s: Service) => out.findIndex((x) => x.id.value === s.id.value);

describe("topoSort", () => {
  it("returns standalone-only services unchanged in count", () => {
    /* @Given three independent standalone services */
    const a = standalone("a"), b = standalone("b"), c = standalone("c");
    /* @When sorted */
    const out = topoSort([a, b, c]);
    /* @Then all are present exactly once */
    assertEquals(out.length, 3);
    assertEquals(new Set(out.map((s) => s.id.value)).size, 3);
  });

  it("orders a host before the service hosted on it", () => {
    /* @Given a host and a dependent hosted on it, passed dependent-first */
    const host = standalone("k3s");
    const dependent = hostedOn("argocd", host.id);
    /* @When sorted */
    const out = topoSort([dependent, host]);
    /* @Then the host lands before its dependent regardless of input order */
    assertEquals(indexOf(out, host) < indexOf(out, dependent), true);
  });

  it("treats a host outside the selection as already satisfied (no throw)", () => {
    /* @Given a hosted service whose host is NOT in the selection */
    const dependent = hostedOn("argocd", new Id());
    /* @When sorted alone @Then it is returned without error (host assumed INSTALLED) */
    const out = topoSort([dependent]);
    assertEquals(out.length, 1);
    assertEquals(out[0].id.value, dependent.id.value);
  });

  it("chains multiple hosted levels host-before-dependent", () => {
    /* @Given a host with two dependents hosted on it */
    const host = standalone("docker");
    const d1 = hostedOn("portainer", host.id);
    const d2 = hostedOn("watchtower", host.id);
    const out = topoSort([d1, d2, host]);
    assertEquals(indexOf(out, host) < indexOf(out, d1), true);
    assertEquals(indexOf(out, host) < indexOf(out, d2), true);
  });

  it("throws on a circular dependency between two hosted services", () => {
    /* @Given two services each declared as hosted on the other */
    const a = new Service(
      new Id(),
      new Name("a"),
      new BlueprintName("x"),
      new Vault(),
      new Inputs({}),
      new Secrets({}),
      [],
      new Host(new Id(), "main"),
      creation(),
    );
    const b = new Service(
      new Id(),
      new Name("b"),
      new BlueprintName("y"),
      new Vault(),
      new Inputs({}),
      new Secrets({}),
      [],
      new Host(a.id, "main"),
      creation(),
    );
    // Close the loop: a is hosted on b.
    const aOnB = new Service(
      a.id,
      new Name("a"),
      new BlueprintName("x"),
      new Vault(),
      new Inputs({}),
      new Secrets({}),
      [],
      new Host(b.id, "main"),
      creation(),
    );
    /* @When sorted @Then the cycle is detected and rejected */
    assertThrows(() => topoSort([aOnB, b]), Error, "circular dependency");
  });
});
