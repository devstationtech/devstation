import { assertEquals, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { RegisterServiceHandler } from "@server/station/application/handlers/register-service-handler.ts";
import { RegisterService } from "@server/station/application/commands/register-service.ts";
import type { Blueprints } from "@server/station/domain/ports/outbound/blueprints.ts";
import type { Stations } from "@server/station/domain/ports/outbound/stations.ts";
import type { Dispatcher } from "@server/shared/building-blocks/domain/ports/events/outbound/dispatcher.ts";
import {
  Blueprint,
  Compatibility,
  Description,
  Name as BlueprintName,
  Role,
  SemVer,
  Step,
  StepDescription,
  StepId,
} from "@server/blueprint/index.ts";
import { Publish } from "@server/blueprint/domain/models/step/publish.ts";
import { OperatingSystem } from "@server/shared/building-blocks/domain/models/value-objects/operating-system.ts";
import { Station } from "@server/station/domain/models/station.ts";
import { Name as StationName } from "@server/station/domain/models/name.ts";
import { Description as StationDescription } from "@server/station/domain/models/description.ts";
import { Creation } from "@server/shared/building-blocks/domain/models/value-objects/creation.ts";
import { User } from "@server/shared/building-blocks/domain/models/value-objects/user.ts";
import { Hostname } from "@server/shared/building-blocks/domain/models/value-objects/hostname.ts";
import { Instant } from "@server/shared/building-blocks/domain/models/value-objects/instant.ts";

/**
 * Regression for service registration when a blueprint declares an
 * optional role with `instances: many` that was incorrectly interpreted
 * as "≥1 required", blocking single-node installs. The fix introduces
 * `zeroOrMore` as a third cardinality (0..N) and updates the validator
 * to skip `zeroOrMore` roles from the "missing instances" check.
 *
 * Tests guard both halves of the contract:
 *  - `zeroOrMore` role can be omitted entirely without error
 *  - `many` role still demands ≥1 instance (back-compat)
 *  - error message names the blueprint + the missing roles + a hint
 */

// deno-lint-ignore no-explicit-any
type Anyish = any;

const STATION_ID = "44444444-4444-4444-4444-444444444444";
const VAULT_ID = "11111111-1111-1111-1111-111111111111";
const USERNAME_SECRET = "22222222-2222-2222-2222-222222222222";
const PASSWORD_SECRET = "33333333-3333-3333-3333-333333333333";

function stubStation(): Station {
  return Station.register(
    new StationName("qa-station"),
    new StationDescription("test"),
    new Creation(
      new User("alice"),
      new Hostname("box"),
      Instant.fromString("2026-01-01T00:00:00.000Z"),
    ),
  );
}

function stubStations(station: Station): Stations {
  return {
    of: () => Promise.resolve(station),
    save: () => Promise.resolve(),
  } as Anyish;
}

function stubBlueprint(
  serverInstances: "one" | "many",
  agentInstances?: "one" | "many" | "zeroOrMore",
): Blueprint {
  const step = new Step(
    new StepId("install"),
    new StepDescription("install"),
    "echo install",
    {},
    null,
    new Publish({}, {}),
    null,
  );
  const roles = [new Role("server", serverInstances, [step])];
  if (agentInstances) roles.push(new Role("agent", agentInstances, [step]));
  return new Blueprint(
    new BlueprintName("k3s"),
    new Description("k3s test"),
    new SemVer("1.0.0"),
    new Compatibility([OperatingSystem.UBUNTU_24_04]),
    "exclusive",
    [],
    roles,
    null,
    [],
  );
}

function stubBlueprints(b: Blueprint): Blueprints {
  return { of: () => Promise.resolve(b) } as Anyish;
}

const stubDispatcher: Dispatcher = { dispatch: () => Promise.resolve() };

function registerCmd(
  instances: Array<{ role: string }> = [{ role: "server" }],
): RegisterService {
  return new RegisterService(
    STATION_ID,
    "k3s-single",
    "k3s",
    VAULT_ID,
    {},
    {},
    "user",
    "host",
    instances.map((i) => ({
      role: i.role,
      host: "10.0.0.1",
      credentialVaultId: VAULT_ID,
      usernameSecretId: USERNAME_SECRET,
      passwordSecretId: PASSWORD_SECRET,
    })),
    null,
  );
}

describe("register-service — `zeroOrMore` role cardinality", () => {
  it("accepts a service with only the required `one`/`many` roles when other roles are `zeroOrMore`", async () => {
    /* @Given a blueprint whose 'agent' role is zeroOrMore */
    const station = stubStation();
    const handler = new RegisterServiceHandler(
      stubStations(station),
      stubBlueprints(stubBlueprint("one", "zeroOrMore")),
      stubDispatcher,
    );
    /* @When registering with only the 'server' instance */
    // Only 'server' instance supplied — 'agent' is zeroOrMore, must be optional.
    await handler.handle(registerCmd([{ role: "server" }]));
    /* @Then the service is created with just the server instance */
    assertEquals(station.services.length, 1);
    assertEquals(station.services[0].instances.length, 1);
    assertEquals(station.services[0].instances[0].role.name, "server");
  });

  it("accepts instances provided FOR a `zeroOrMore` role (agents are optional, not forbidden)", async () => {
    /* @Given a blueprint whose 'agent' role is zeroOrMore */
    const station = stubStation();
    const handler = new RegisterServiceHandler(
      stubStations(station),
      stubBlueprints(stubBlueprint("one", "zeroOrMore")),
      stubDispatcher,
    );
    /* @When registering with a server AND an agent instance */
    await handler.handle(registerCmd([{ role: "server" }, { role: "agent" }]));
    /* @Then both instances land on the service */
    assertEquals(station.services.length, 1);
    assertEquals(
      station.services[0].instances.map((i) => i.role.name).sort(),
      ["agent", "server"],
    );
  });

  it("still demands ≥1 instance for `many` roles (back-compat)", async () => {
    /* @Given a blueprint whose 'agent' role is many */
    const station = stubStation();
    const handler = new RegisterServiceHandler(
      stubStations(station),
      stubBlueprints(stubBlueprint("one", "many")),
      stubDispatcher,
    );
    /* @When registering without an 'agent' instance */
    /* @Then it rejects naming the role missing instances */
    await assertRejects(
      () => handler.handle(registerCmd([{ role: "server" }])),
      Error,
      "roles without instances: agent",
    );
  });

  it("error message names the blueprint and gives a concrete fix hint", async () => {
    /* @Given a blueprint whose 'agent' role is many */
    const station = stubStation();
    const handler = new RegisterServiceHandler(
      stubStations(station),
      stubBlueprints(stubBlueprint("one", "many")),
      stubDispatcher,
    );
    /* @When registration fails for the missing role */
    try {
      await handler.handle(registerCmd([{ role: "server" }]));
    } catch (e) {
      /* @Then the message names the blueprint, the role, a copy-paste shape and the escape hatch */
      const msg = (e as Error).message;
      assertEquals(msg.includes("k3s"), true); // names the blueprint
      assertEquals(msg.includes("agent"), true); // names the missing role
      assertEquals(msg.includes("instances:[{role:'agent'"), true); // gives copy-paste shape
      assertEquals(msg.includes("zeroOrMore"), true); // points at the escape hatch
    }
  });
});
