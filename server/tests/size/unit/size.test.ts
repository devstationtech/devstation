import { assert, assertEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Provider } from "@server/shared/building-blocks/domain/models/value-objects/provider.ts";
import { registeredProxmoxSize } from "@tests/size/fixtures/operations.ts";

describe("ProxmoxSize.register", () => {
  it("should register a new proxmox size", () => {
    /* @Given a valid proxmox registration operation */
    const size = registeredProxmoxSize("small", 2, 2048, 20);

    /* @When the registration is executed */

    /* @Then the size should hold the operation data */
    assert(size.id.value.length > 0);
    assertEquals(size.name.value, "small");
    assertEquals(size.provider, Provider.PROXMOX);
    assertEquals(size.cpu.value, 2);
    assertEquals(size.ram.value, 2048);
    assertEquals(size.disk.value, 20);
    assertEquals(size.version.value, 1);
    assertEquals(size.creation.by.value, "test-user");
    assertEquals(size.creation.hostname.value, "test-host");
    assert(size.creation.at.toString() != null);
  });
});

describe("Name", () => {
  it("should reject an empty name", () => {
    /* @Given an empty name */
    /* @When the operation is built */
    /* @Then an exception should be thrown */
    assertThrows(() => registeredProxmoxSize(""), Error, "Value is required");
  });

  it("should reject a name with uppercase characters", () => {
    /* @Given a name with uppercase letters */
    /* @When the operation is built */
    /* @Then an exception should be thrown */
    assertThrows(() => registeredProxmoxSize("Small"), Error, "lowercase slug");
  });
});

describe("Cpu", () => {
  it("should reject zero", () => {
    /* @Given a cpu value equal to zero */
    /* @When the operation is built */
    /* @Then an exception should be thrown */
    assertThrows(() => registeredProxmoxSize("small", 0), Error, "positive integer");
  });

  it("should reject a negative value", () => {
    /* @Given a negative cpu value */
    /* @When the operation is built */
    /* @Then an exception should be thrown */
    assertThrows(() => registeredProxmoxSize("small", -1), Error, "positive integer");
  });

  it("should reject a non-integer", () => {
    /* @Given a non-integer cpu value */
    /* @When the operation is built */
    /* @Then an exception should be thrown */
    assertThrows(() => registeredProxmoxSize("small", 1.5), Error, "positive integer");
  });
});

describe("Ram", () => {
  it("should reject zero", () => {
    /* @Given a ram value equal to zero */
    /* @When the operation is built */
    /* @Then an exception should be thrown */
    assertThrows(() => registeredProxmoxSize("small", 2, 0), Error, "positive integer");
  });

  it("should reject a negative value", () => {
    /* @Given a negative ram value */
    /* @When the operation is built */
    /* @Then an exception should be thrown */
    assertThrows(() => registeredProxmoxSize("small", 2, -512), Error, "positive integer");
  });

  it("should reject a non-integer", () => {
    /* @Given a non-integer ram value */
    /* @When the operation is built */
    /* @Then an exception should be thrown */
    assertThrows(() => registeredProxmoxSize("small", 2, 1024.5), Error, "positive integer");
  });
});

describe("Disk", () => {
  it("should reject zero", () => {
    /* @Given a disk value equal to zero */
    /* @When the operation is built */
    /* @Then an exception should be thrown */
    assertThrows(() => registeredProxmoxSize("small", 2, 2048, 0), Error, "positive integer");
  });

  it("should reject a negative value", () => {
    /* @Given a negative disk value */
    /* @When the operation is built */
    /* @Then an exception should be thrown */
    assertThrows(
      () => registeredProxmoxSize("small", 2, 2048, -10),
      Error,
      "positive integer",
    );
  });

  it("should reject a non-integer", () => {
    /* @Given a non-integer disk value */
    /* @When the operation is built */
    /* @Then an exception should be thrown */
    assertThrows(
      () => registeredProxmoxSize("small", 2, 2048, 10.5),
      Error,
      "positive integer",
    );
  });
});

describe("ProxmoxSize.creation", () => {
  it("should reject an empty user", () => {
    /* @Given an empty user at creation */
    /* @When the operation is built */
    /* @Then an exception should be thrown */
    assertThrows(
      () => registeredProxmoxSize("small", 2, 2048, 20, "", "test-host"),
      Error,
      "user is required",
    );
  });

  it("should reject an empty hostname", () => {
    /* @Given an empty hostname at creation */
    /* @When the operation is built */
    /* @Then an exception should be thrown */
    assertThrows(
      () => registeredProxmoxSize("small", 2, 2048, 20, "test-user", ""),
      Error,
      "hostname is required",
    );
  });
});
