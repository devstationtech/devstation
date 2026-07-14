import { assertEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { hostChainInstances } from "@server/station/application/services/run-service.ts";
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
 * `hostChainInstances` resolves the VMs a hosted service runs on by walking
 * the host chain to the standalone root. Hosted services carry no instances
 * of their own (domain invariant), so a one-level lookup breaks every
 * blueprint hosted on another hosted service — the shipped catalog does this
 * (nginx-proxy-manager on portainer, itself on docker). Pinned here.
 */

const creation = () => Creation.now(new User("u"), new Hostname("h"));

function standalone(name: string, hosts: string[]): Service {
  return new Service(
    new Id(),
    new Name(name),
    new BlueprintName("docker"),
    new Vault(),
    new Inputs({}),
    new Secrets({}),
    hosts.map((host) =>
      new Instance(
        new Role("main"),
        host,
        new Credential(new Vault(), new Secret(), new Secret()),
      )
    ),
    null,
    creation(),
  );
}

function hostedOn(name: string, hostServiceId: Id, role = "main"): Service {
  return new Service(
    new Id(),
    new Name(name),
    new BlueprintName("argocd"),
    new Vault(),
    new Inputs({}),
    new Secrets({}),
    [],
    new Host(hostServiceId, role),
    creation(),
  );
}

function lookupIn(services: Service[]): (id: Service["id"]) => Service {
  return (id) => {
    const found = services.find((s) => s.id.value === id.value);
    if (!found) throw new Error(`service '${id.value}' not found`);
    return found;
  };
}

describe("hostChainInstances", () => {
  it("returns a standalone service's own instances", () => {
    /* @Given a standalone service with two instances */
    const docker = standalone("docker", ["10.0.0.1", "10.0.0.2"]);
    /* @When resolved @Then its own instances come back */
    const out = hostChainInstances(docker, lookupIn([docker]));
    assertEquals(out.map((i) => i.host), ["10.0.0.1", "10.0.0.2"]);
  });

  it("resolves one hosted level to the standalone host's instances", () => {
    /* @Given portainer hosted on docker.main */
    const docker = standalone("docker", ["10.0.0.1"]);
    const portainer = hostedOn("portainer", docker.id);
    /* @When resolved @Then docker's instances come back */
    const out = hostChainInstances(portainer, lookupIn([docker, portainer]));
    assertEquals(out.map((i) => i.host), ["10.0.0.1"]);
  });

  it("walks a hosted-on-hosted chain to the standalone root", () => {
    /* @Given the shipped catalog shape: npm on portainer on docker */
    const docker = standalone("docker", ["10.0.0.1"]);
    const portainer = hostedOn("portainer", docker.id);
    const npm = hostedOn("nginx-proxy-manager", portainer.id);
    /* @When the deepest service resolves */
    const out = hostChainInstances(npm, lookupIn([docker, portainer, npm]));
    /* @Then it lands on docker's instances */
    assertEquals(out.map((i) => i.host), ["10.0.0.1"]);
  });

  it("filters by the role declared at each hop", () => {
    /* @Given a host chain bound to a role the root has no instances of */
    const docker = standalone("docker", ["10.0.0.1"]);
    const other = hostedOn("other", docker.id, "agent");
    /* @When resolved @Then no instance matches */
    const out = hostChainInstances(other, lookupIn([docker, other]));
    assertEquals(out.length, 0);
  });

  it("throws on a cyclic host chain instead of recursing forever", () => {
    /* @Given two services each hosted on the other */
    const a = hostedOn("a", new Id());
    const b = hostedOn("b", a.id);
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
    /* @When resolved @Then the cycle is detected */
    assertThrows(
      () => hostChainInstances(aOnB, lookupIn([aOnB, b])),
      Error,
      "cycle",
    );
  });
});
