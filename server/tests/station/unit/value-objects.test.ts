import { assertEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Description } from "@server/station/domain/models/description.ts";
import { Inputs } from "@server/station/domain/models/service/inputs.ts";
import { Secrets } from "@server/station/domain/models/service/secrets.ts";
import { Host } from "@server/station/domain/models/service/host.ts";
import { Id as ServiceId } from "@server/station/domain/models/service/id.ts";
import { Role } from "@server/station/domain/models/service/role.ts";
import { InstallResult } from "@server/station/domain/models/service/install-result.ts";
import { Secret } from "@server/shared/building-blocks/domain/models/value-objects/secret.ts";

/**
 * Station value objects — small but each pins a specific contract
 * that BC code depends on. Description allows empty; Inputs preserves
 * structural copies; Secrets throws on missing; Host requires a role.
 */

describe("Station Description", () => {
  it("allows an empty description (the field is optional for operators)", () => {
    /* @Given an empty string */
    /* @When Description is constructed */
    /* @Then no error — the user can label later */
    assertEquals(new Description("").value, "");
  });

  it("accepts content up to 200 characters", () => {
    assertEquals(new Description("x".repeat(200)).value.length, 200);
  });

  it("rejects 201+ characters", () => {
    assertThrows(() => new Description("x".repeat(201)), Error, "200");
  });
});

describe("Inputs", () => {
  it("toRecord returns a shallow copy (caller can mutate without affecting the VO)", () => {
    /* @Given an Inputs holding {host: "example", port: 80, ssl: true} */
    const inputs = new Inputs({ host: "example", port: 80, ssl: true });
    /* @When toRecord() is called and the caller mutates the result */
    const copy = inputs.toRecord();
    copy.host = "evil";
    /* @Then the original VO is unchanged — defensive copy semantics */
    assertEquals(inputs.toRecord(), { host: "example", port: 80, ssl: true });
  });

  it("preserves mixed primitive types (string, number, boolean) verbatim", () => {
    const inputs = new Inputs({ s: "x", n: 1, b: false });
    assertEquals(inputs.values, { s: "x", n: 1, b: false });
  });

  it("supports an empty Inputs (no inputs declared by the stack)", () => {
    assertEquals(new Inputs({}).toRecord(), {});
  });
});

describe("Secrets", () => {
  const vaultId = "00000000-0000-0000-0000-000000000010";
  const secretA = new Secret("00000000-0000-0000-0000-000000000011");
  const secretB = new Secret("00000000-0000-0000-0000-000000000012");

  it("has() returns true only for registered names", () => {
    /* @Given a Secrets with two entries */
    const secrets = new Secrets({ token: secretA, key: secretB });
    /* @Then has reflects exactly the registered keys */
    assertEquals(secrets.has("token"), true);
    assertEquals(secrets.has("key"), true);
    assertEquals(secrets.has("missing"), false);
  });

  it("get(name) returns the registered Secret", () => {
    const secrets = new Secrets({ token: secretA });
    assertEquals(secrets.get("token"), secretA);
  });

  it("get(name) throws when the secret is not registered (silently returning undefined would corrupt installs)", () => {
    /* @Given a Secrets without 'missing' */
    /* @When get('missing') is called */
    /* @Then it throws with the missing name — fails fast at install time */
    const secrets = new Secrets({ token: secretA });
    assertThrows(() => secrets.get("missing"), Error, "missing");
  });

  it("names() lists the registered keys in registration order", () => {
    /* @Given a Secrets registered in order [a, b, c] */
    const secrets = new Secrets({
      a: secretA,
      b: secretB,
      c: new Secret("00000000-0000-0000-0000-000000000013"),
    });
    /* @Then names() preserves the Object.entries order */
    assertEquals(secrets.names(), ["a", "b", "c"]);
    // vaultId is captured by the fixture; sanity check the test data
    assertEquals(typeof vaultId, "string");
  });

  it("toRecord round-trips into a plain Record (serializable)", () => {
    const secrets = new Secrets({ token: secretA });
    assertEquals(secrets.toRecord(), { token: secretA });
  });
});

describe("Service Host", () => {
  it("accepts a non-empty role on a referenced service id", () => {
    const id = new ServiceId();
    const host = new Host(id, "server");
    assertEquals(host.service, id);
    assertEquals(host.role, "server");
  });

  it("rejects an empty role", () => {
    /* @Given a referenced service id */
    /* @When Host is constructed with role="" */
    /* @Then it throws — a hosted service must point at a specific role of its host */
    assertThrows(() => new Host(new ServiceId(), ""), Error, "host.role");
  });
});

describe("Role", () => {
  it("accepts lowercase slugs (single char, hyphenated, alphanumeric)", () => {
    /* @Given the slug forms a topology role takes (k3s server/agent, pg primary) */
    for (const v of ["main", "server", "agent", "primary", "replica", "a", "n0", "db-1"]) {
      assertEquals(new Role(v).name, v);
    }
  });

  it("rejects an empty name", () => {
    assertThrows(() => new Role(""), Error, "required");
  });

  it("rejects names longer than 64 characters", () => {
    /* @Given a 65-char name */
    /* @When Role is constructed */
    /* @Then it throws — the slot name must stay short for persistence keys */
    assertThrows(() => new Role("r".repeat(65)), Error, "64");
  });

  it("rejects non-slug names (uppercase, spaces, leading/trailing hyphen, symbols)", () => {
    /* @Given values that aren't lowercase hyphen-slugs */
    /* @When Role is constructed */
    /* @Then each throws — role names key persistence + event payloads */
    for (const v of ["Server", "my role", "-edge", "edge-", "db_1", "café"]) {
      assertThrows(() => new Role(v), Error, "slug");
    }
  });
});

describe("InstallResult", () => {
  it("carries blueprint version, secrets and outputs verbatim", () => {
    /* @Given a install that produced one secret + two outputs */
    const result = new InstallResult(
      { version: "1.4.0" },
      { token: "s3cr3t" },
      { ip: "10.0.0.5", host: "k3s-1" },
    );
    /* @Then every field round-trips unchanged */
    assertEquals(result.blueprint.version, "1.4.0");
    assertEquals(result.secrets, { token: "s3cr3t" });
    assertEquals(result.outputs, { ip: "10.0.0.5", host: "k3s-1" });
  });

  it("allows empty secrets and outputs (a install may produce neither)", () => {
    const result = new InstallResult({ version: "1.0.0" }, {}, {});
    assertEquals(result.secrets, {});
    assertEquals(result.outputs, {});
  });

  it("rejects a missing blueprint version (re-install detection + audit need it)", () => {
    /* @Given a blueprint descriptor with an empty version */
    /* @When InstallResult is constructed */
    /* @Then it throws — version is the identity used by re-install detection */
    assertThrows(() => new InstallResult({ version: "" }, {}, {}), Error, "version");
  });
});
