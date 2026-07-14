import { assertEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  Blueprint,
  Compatibility,
  Description,
  Host,
  Name,
  Role,
  SemVer,
} from "@server/blueprint/index.ts";
import { OperatingSystem } from "@server/shared/building-blocks/domain/models/value-objects/operating-system.ts";
import { aHostedStack, aRole, aStack, aStep } from "@tests/blueprint/fixtures/stacks.ts";

describe("Blueprint constructor", () => {
  it("should build a base blueprint with one role and steps", () => {
    /* @Given valid data for a base single-role blueprint */
    const blueprint = aStack("docker", [aRole("main", [aStep("install"), aStep("verify")])]);

    /* @Then the blueprint reflects the given content */
    assertEquals(blueprint.name.value, "docker");
    assertEquals(blueprint.placement, "exclusive");
    assertEquals(blueprint.isHosted, false);
    assertEquals(blueprint.roles.length, 1);
    assertEquals(blueprint.roles[0].name, "main");
    assertEquals(blueprint.roles[0].instances, "one");
    assertEquals(blueprint.roles[0].installSteps.length, 2);
    assertEquals(blueprint.roles[0].installSteps[0].id.value, "install");
  });

  it("should reject empty roles AND missing host", () => {
    /* @Given a blueprint without roles and without host */
    /* @Then constructing should throw */
    assertThrows(
      () =>
        new Blueprint(
          new Name("empty"),
          new Description("d"),
          new SemVer("1.0.0"),
          new Compatibility([OperatingSystem.UBUNTU_22_04]),
          "exclusive",
          [],
          [],
          null,
          [],
        ),
      Error,
      "must declare either 'roles'",
    );
  });

  it("should reject having both roles and host", () => {
    /* @Given a blueprint with both roles and host */
    /* @Then constructing should throw */
    assertThrows(
      () =>
        new Blueprint(
          new Name("dual"),
          new Description("d"),
          new SemVer("1.0.0"),
          new Compatibility([OperatingSystem.UBUNTU_22_04]),
          "exclusive",
          [],
          [new Role("main", "one", [aStep()])],
          new Host(new Name("k3s"), "server"),
          [aStep()],
        ),
      Error,
      "cannot declare both",
    );
  });

  it("should reject duplicate role names", () => {
    /* @Given roles with repeated names */
    /* @Then constructing should throw */
    assertThrows(
      () =>
        new Blueprint(
          new Name("dup"),
          new Description("d"),
          new SemVer("1.0.0"),
          new Compatibility([OperatingSystem.UBUNTU_22_04]),
          "exclusive",
          [],
          [
            new Role("server", "one", [aStep()]),
            new Role("server", "one", [aStep()]),
          ],
          null,
          [],
        ),
      Error,
      "declared more than once",
    );
  });

  it("should accept multiple roles with different instances cardinalities", () => {
    /* @Given distinct roles with different instances */
    const blueprint = aStack("k3s", [
      aRole("server", [aStep("install-server")], "one"),
      aRole("agent", [aStep("install-agent")], "many"),
    ]);

    /* @Then the blueprint exposes both with their instances values */
    assertEquals(blueprint.roles.length, 2);
    assertEquals(blueprint.roles.map((r) => r.name), ["server", "agent"]);
    assertEquals(blueprint.roles.map((r) => r.instances), ["one", "many"]);
  });

  it("should build a hosted blueprint with host and top-level steps", () => {
    /* @Given a valid hosted blueprint */
    const blueprint = aHostedStack("argocd", "k3s", "server", [aStep("install")]);

    /* @Then the blueprint reports itself as hosted */
    assertEquals(blueprint.isHosted, true);
    assertEquals(blueprint.host?.blueprint.value, "k3s");
    assertEquals(blueprint.host?.role, "server");
    assertEquals(blueprint.roles.length, 0);
    assertEquals(blueprint.installSteps.length, 1);
  });

  it("should reject hosted blueprint without steps", () => {
    /* @Given a hosted blueprint without steps */
    /* @Then constructing should throw */
    assertThrows(
      () =>
        new Blueprint(
          new Name("hosted"),
          new Description("d"),
          new SemVer("1.0.0"),
          new Compatibility([OperatingSystem.UBUNTU_22_04]),
          "exclusive",
          [],
          [],
          new Host(new Name("k3s"), "server"),
          [],
        ),
      Error,
      "hosted blueprint must declare 'install'",
    );
  });

  it("should reject base blueprint with top-level steps", () => {
    /* @Given a base with both roles and top-level steps */
    /* @Then constructing should throw */
    assertThrows(
      () =>
        new Blueprint(
          new Name("mixed"),
          new Description("d"),
          new SemVer("1.0.0"),
          new Compatibility([OperatingSystem.UBUNTU_22_04]),
          "exclusive",
          [],
          [new Role("main", "one", [aStep()])],
          null,
          [aStep()],
        ),
      Error,
      "puts install steps inside roles",
    );
  });
});

describe("Role", () => {
  it("should reject empty name", () => {
    assertThrows(() => new Role("", "one", [aStep()]), Error, "role name");
  });

  it("should reject empty steps", () => {
    assertThrows(() => new Role("server", "one", []), Error, "at least one step");
  });
});

describe("Host", () => {
  it("should reject empty role", () => {
    assertThrows(() => new Host(new Name("k3s"), ""), Error, "host.role is required");
  });
});
