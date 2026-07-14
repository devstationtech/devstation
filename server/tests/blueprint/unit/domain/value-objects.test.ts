import { assertEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { SemVer } from "@server/blueprint/domain/models/sem-ver.ts";
import { Description } from "@server/blueprint/domain/models/description.ts";
import { Description as StepDescription } from "@server/blueprint/domain/models/step/description.ts";
import { Label } from "@server/blueprint/domain/models/input/label.ts";
import { Help } from "@server/blueprint/domain/models/input/help.ts";
import { Compatibility } from "@server/blueprint/domain/models/compatibility.ts";
import { Host } from "@server/blueprint/domain/models/host.ts";
import { Role } from "@server/blueprint/domain/models/role.ts";
import { Step } from "@server/blueprint/domain/models/step/step.ts";
import { StepId } from "@server/blueprint/index.ts";
import { Name } from "@server/blueprint/domain/models/name.ts";
import { Publish } from "@server/blueprint/domain/models/step/publish.ts";
import { OperatingSystem } from "@server/shared/building-blocks/domain/models/value-objects/operating-system.ts";
import { Result as VerifyResult } from "@server/blueprint/contracts/step/verify/result.ts";

/**
 * Small domain value objects — their entire surface is constructor-time
 * validation. Grouped into one file so the suite stays compact.
 *
 * Naming convention: each test reads like a Gherkin scenario, with
 * @Given/@When/@Then comments only where the intent isn't obvious
 * from the assertion itself.
 */

describe("SemVer", () => {
  it("accepts a valid MAJOR.MINOR.PATCH version", () => {
    assertEquals(new SemVer("1.0.0").value, "1.0.0");
    assertEquals(new SemVer("0.0.0").toString(), "0.0.0");
    assertEquals(new SemVer("10.20.30").value, "10.20.30");
  });

  it("rejects empty input", () => {
    assertThrows(() => new SemVer(""), Error, "required");
  });

  it("rejects strings missing a segment (1.0 or 1)", () => {
    /* @Given a 2-segment version */
    /* @When SemVer is constructed */
    /* @Then it throws — semver requires three segments */
    assertThrows(() => new SemVer("1.0"), Error, "MAJOR.MINOR.PATCH");
    assertThrows(() => new SemVer("1"), Error, "MAJOR.MINOR.PATCH");
  });

  it("rejects extra segments (1.0.0.0)", () => {
    assertThrows(() => new SemVer("1.0.0.0"), Error, "MAJOR.MINOR.PATCH");
  });

  it("rejects non-numeric segments (a.b.c, 1.x.0)", () => {
    assertThrows(() => new SemVer("a.b.c"), Error);
    assertThrows(() => new SemVer("1.x.0"), Error);
  });
});

describe("Description (blueprint)", () => {
  it("accepts non-empty up to 200 characters", () => {
    assertEquals(new Description("short").value, "short");
    assertEquals(new Description("x".repeat(200)).value.length, 200);
  });

  it("rejects empty", () => {
    assertThrows(() => new Description(""), Error, "required");
  });

  it("rejects 201+ characters (length boundary is inclusive at 200)", () => {
    assertThrows(() => new Description("x".repeat(201)), Error, "200");
  });
});

describe("Description (step)", () => {
  it("accepts non-empty up to 120 characters", () => {
    assertEquals(new StepDescription("describe me").value, "describe me");
    assertEquals(new StepDescription("x".repeat(120)).value.length, 120);
  });

  it("rejects empty", () => {
    assertThrows(() => new StepDescription(""), Error, "required");
  });

  it("rejects 121+ characters (step max is 120, not 200)", () => {
    assertThrows(() => new StepDescription("x".repeat(121)), Error, "120");
  });
});

describe("Label (input)", () => {
  it("accepts non-empty up to 80 characters", () => {
    assertEquals(new Label("Token").value, "Token");
    assertEquals(new Label("x".repeat(80)).value.length, 80);
  });

  it("rejects empty", () => {
    assertThrows(() => new Label(""), Error, "required");
  });

  it("rejects 81+ characters", () => {
    assertThrows(() => new Label("x".repeat(81)), Error, "80");
  });
});

describe("Help (input)", () => {
  it("accepts non-empty up to 200 characters", () => {
    assertEquals(new Help("Tooltip").value, "Tooltip");
    assertEquals(new Help("x".repeat(200)).value.length, 200);
  });

  it("rejects empty", () => {
    assertThrows(() => new Help(""), Error, "required");
  });

  it("rejects 201+ characters", () => {
    assertThrows(() => new Help("x".repeat(201)), Error, "200");
  });
});

describe("Compatibility", () => {
  it("accepts a non-empty OS list", () => {
    const c = new Compatibility([OperatingSystem.UBUNTU_22_04]);
    assertEquals(c.os.length, 1);
  });

  it("accepts multiple OSes", () => {
    const c = new Compatibility([OperatingSystem.UBUNTU_22_04, OperatingSystem.UBUNTU_24_04]);
    assertEquals(c.os.length, 2);
  });

  it("rejects an empty OS list — a blueprint without any compatible OS is useless", () => {
    assertThrows(() => new Compatibility([]), Error, "at least one");
  });
});

describe("Host", () => {
  it("accepts a non-empty role on a referenced blueprint name", () => {
    const h = new Host(new Name("k3s"), "server");
    assertEquals(h.blueprint.value, "k3s");
    assertEquals(h.role, "server");
  });

  it("rejects an empty role", () => {
    /* @Given a referenced blueprint name */
    /* @When Host is constructed with role="" */
    /* @Then it throws — a hosted blueprint must declare which role of the host runs it */
    assertThrows(() => new Host(new Name("k3s"), ""), Error, "host.role");
  });
});

describe("Role", () => {
  function aStep(id = "install"): Step {
    return new Step(
      new StepId(id),
      new StepDescription("desc"),
      "echo go",
      {},
      null,
      new Publish({}, {}),
      null,
    );
  }

  it("accepts a non-empty name and a non-empty step list", () => {
    const r = new Role("main", "one", [aStep()]);
    assertEquals(r.name, "main");
    assertEquals(r.instances, "one");
    assertEquals(r.installSteps.length, 1);
  });

  it("rejects an empty name", () => {
    assertThrows(() => new Role("", "one", [aStep()]), Error, "role name");
  });

  it("rejects empty steps — a role with no work is meaningless and would silently no-op", () => {
    assertThrows(() => new Role("main", "one", []), Error, "at least one step");
  });
});

describe("Step", () => {
  it("accepts a non-empty shell command", () => {
    const step = new Step(
      new StepId("install"),
      new StepDescription("install"),
      "apt-get install -y docker",
      {},
      null,
      new Publish({}, {}),
      null,
    );
    assertEquals(step.shell, "apt-get install -y docker");
  });

  it("rejects an empty shell — a step that doesn't run anything is a config bug", () => {
    assertThrows(
      () =>
        new Step(
          new StepId("install"),
          new StepDescription("install"),
          "",
          {},
          null,
          new Publish({}, {}),
          null,
        ),
      Error,
      "shell is required",
    );
  });

  it("includes the step id in the shell-missing error so the operator can find the offender", () => {
    /* @Given a step with shell="" and a known id */
    /* @When Step is constructed */
    /* @Then the error embeds the id (so a YAML with many steps points at the right one) */
    assertThrows(
      () =>
        new Step(
          new StepId("configure"),
          new StepDescription("d"),
          "",
          {},
          null,
          new Publish({}, {}),
          null,
        ),
      Error,
      "configure",
    );
  });
});

describe("VerifyResult", () => {
  it("healthy() carries healthy=true and no reason", () => {
    const r = VerifyResult.healthy();
    assertEquals(r.healthy, true);
    assertEquals(r.reason, undefined);
  });

  it("unhealthy(reason) carries healthy=false and the reason", () => {
    const r = VerifyResult.unhealthy("port 6443 closed");
    assertEquals(r.healthy, false);
    assertEquals(r.reason, "port 6443 closed");
  });

  it("unhealthy('') is rejected — an unhealthy result must explain itself", () => {
    /* @Given an empty reason */
    /* @When unhealthy is constructed */
    /* @Then it throws — a failed probe is useless without a reason */
    assertThrows(() => VerifyResult.unhealthy(""), Error, "requires a reason");
  });
});
