/// <reference types="@types/react" />
import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { buildRoleSection, instancesPickedElsewhere } from "@ui/service/form.tsx";
import type { StationInstanceRecord } from "@jsonrpc-contracts-ts/station.gen.ts";
import type { BlueprintRecord } from "@jsonrpc-contracts-ts/blueprint.gen.ts";

/**
 * Regression: a VM may fill exactly one role/slot. Picking `k3s-server`
 * for the `server` role must remove it from the `agent` role selector
 * (and from other agent slots). Previously the selector listed every
 * compatible VM for every role, allowing the same VM in two roles.
 */

function vm(id: string, name: string, os = "ubuntu-24-04"): StationInstanceRecord {
  return {
    id,
    name,
    host: `10.0.0.${id}`,
    os,
    provider: "proxmox",
    cluster: { id: "c", name: "homelab" },
    node: { id: "n", name: "cp4" },
    specs: { cpu: 2, ram: 2048, disk: 20 },
    credentialVaultId: "v",
    usernameSecretId: "u",
    passwordSecretId: "p",
    busy: false,
    busyBy: null,
  } as unknown as StationInstanceRecord;
}

function k3sStack(): BlueprintRecord {
  return {
    name: "k3s",
    compatibility: { os: ["ubuntu-24-04"] },
    roles: [
      { name: "server", instances: "one", steps: [] },
      { name: "agent", instances: "many", steps: [] },
    ],
    inputs: [],
    host: null,
  } as unknown as BlueprintRecord;
}

const ids = (
  section: { fields?: unknown[] },
  field = 0,
): string[] =>
  ((section.fields ?? [])[field] as { options: { value: string }[] }).options.map((o) => o.value);

describe("buildRoleSection — a VM fills exactly one role/slot", () => {
  const instances = [vm("1", "k3s-server"), vm("2", "k3s-agent"), vm("3", "k3s-agent-test")];
  const stack = k3sStack();

  it("excludes a VM already picked for another role", () => {
    /* @Given VM "1" already picked for the server role */
    const values = { role_server_0: "1" };
    /* @When the agent role section is built */
    const agent = buildRoleSection(stack, stack.roles[1], instances, values);
    /* @Then VM "1" is excluded from the agent options */
    assertEquals(ids(agent), ["2", "3"]); // VM "1" gone, picked by server
  });

  it("keeps the field's own current selection so it can still render/swap", () => {
    /* @Given VM "1" picked for the server role */
    const values = { role_server_0: "1" };
    /* @When the server role section is rebuilt */
    const server = buildRoleSection(stack, stack.roles[0], instances, values);
    /* @Then its own current pick stays visible so it can render/swap */
    assertEquals(ids(server), ["1", "2", "3"]); // own pick stays visible
  });

  it("excludes across slots of the same many-role", () => {
    /* @Given VM "2" picked in agent slot 0 of a many-role */
    const values = { role_agent_0: "2" };
    /* @When the agent role section is built */
    const agent = buildRoleSection(stack, stack.roles[1], instances, values);
    /* @Then slot 0 keeps its own pick while slot 1 excludes "2" */
    assertEquals(ids(agent, 0), ["1", "2", "3"]); // slot 0 holds "2": full list
    // slot 1 is optional: leading "— none —" then the rest, minus slot 0's "2"
    assertEquals(ids(agent, 1), ["", "1", "3"]);
  });

  it("instancesPickedElsewhere ignores the excepted field and non-role keys", () => {
    /* @Given values across roles plus the excepted field and a non-role key */
    const taken = instancesPickedElsewhere(
      { role_server_0: "1", role_agent_0: "2", vault: "x", role_agent_1: "" },
      "role_agent_0",
    );
    /* @Then only picks from other role fields are reported as taken */
    assertEquals([...taken].sort(), ["1"]);
  });
});
