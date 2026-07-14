import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Blueprints } from "@server/blueprint/blueprints.ts";
import { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import { resolve } from "@server/blueprint/parser/template/resolve/resolve.ts";
import { preresolveSecrets } from "@server/blueprint/parser/template/secrets.ts";
import type { Context as StepContext } from "@server/blueprint/contracts/step/context/context.ts";
import type { Peer } from "@server/blueprint/contracts/step/context/peer.ts";
import type { Blueprint } from "@server/blueprint/domain/models/blueprint.ts";
import type { Step } from "@server/blueprint/domain/models/step/step.ts";

/** The repo's real blueprint catalog — read-only, deterministic. */
const CATALOG_ROOT = "blueprints";

/**
 * Regression guard: the template engine fails loudly on any `${...}` it does
 * not recognise, so a blueprint whose shell uses brace-form variables
 * (`${STACK_ID}`) parses fine but blows up at install time. This suite renders
 * every shell string of every catalog blueprint against a permissive context —
 * a stray placeholder fails here instead of on a user's VM.
 */
const anyRecord: Record<string, string> = new Proxy(
  {},
  { get: () => "stub", has: () => true },
);

function permissiveContext(): StepContext {
  const peer: Peer = {
    role: { name: "peer" },
    host: "10.0.0.1",
    secrets: anyRecord,
    outputs: anyRecord,
  };
  return {
    inputs: { string: () => "stub", number: () => 0, boolean: () => false },
    secrets: { get: () => Promise.resolve("stub"), put: () => Promise.resolve() },
    ssh: {
      run: () => Promise.resolve({ exitCode: 0, stdout: "", stderr: "" }),
      upload: () => Promise.resolve(),
    },
    role: { name: "main" },
    host: "10.0.0.1",
    fromRole: () => ({ first: () => peer, all: () => [peer] }),
  };
}

function stepsOf(blueprint: Blueprint): Step[] {
  return [
    ...blueprint.installSteps,
    ...blueprint.uninstallSteps,
    ...blueprint.roles.flatMap((role) => [...role.installSteps, ...role.uninstallSteps]),
  ];
}

function shellStringsOf(step: Step): string[] {
  return [
    step.shell,
    ...Object.values(step.env),
    ...(step.verify ? [step.verify.shell] : []),
    ...(step.rollback ? [step.rollback] : []),
  ];
}

describe("blueprint catalog — templating", () => {
  it("resolves every template in every shipped blueprint", async () => {
    /* @Given the real blueprint catalog */
    const blueprints = await new Blueprints(new FileSystem(CATALOG_ROOT)).list();
    /* a missing catalog root contributes nothing — guard against a vacuous pass */
    assertEquals(blueprints.length > 0, true);
    const ctx = permissiveContext();

    for (const blueprint of blueprints) {
      for (const step of stepsOf(blueprint)) {
        for (const template of shellStringsOf(step)) {
          /* @When rendering each shell string with a permissive context */
          /* @Then no unknown `${...}` placeholder remains */
          try {
            resolve(await preresolveSecrets(template, ctx), { ctx, host: ctx.host });
          } catch (error) {
            throw new Error(
              `blueprint '${blueprint.name.value}', step '${step.id.value}': ${
                (error as Error).message
              }`,
            );
          }
        }
      }
    }
  });
});
