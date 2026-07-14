import { assertEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Ip } from "@server/cluster/domain/models/proxmox/nodes/ip.ts";
import { Gateway } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/network/gateway.ts";
import { Dns } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/network/dns.ts";
import { Network } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/network/network.ts";

describe("Ip", () => {
  it("should accept a valid IPv4 address", () => {
    /* @Given a valid IPv4 address */
    const ip = new Ip("192.168.15.100");
    /* @Then it should store the value */
    assertEquals(ip.value, "192.168.15.100");
  });

  it("should accept 0.0.0.0", () => {
    /* @Given the address 0.0.0.0 */
    const ip = new Ip("0.0.0.0");
    /* @Then it should accept */
    assertEquals(ip.value, "0.0.0.0");
  });

  it("should accept 255.255.255.255", () => {
    /* @Given the address 255.255.255.255 */
    const ip = new Ip("255.255.255.255");
    /* @Then it should accept */
    assertEquals(ip.value, "255.255.255.255");
  });

  it("should reject an empty string", () => {
    /* @Given an empty string */
    /* @Then it should throw an error */
    assertThrows(() => new Ip(""), Error, "ip is required");
  });

  it("should reject an invalid format", () => {
    /* @Given an invalid format */
    /* @Then it should throw an error */
    assertThrows(() => new Ip("not-an-ip"), Error, "valid IPv4");
  });

  it("should reject an octet greater than 255", () => {
    /* @Given an octet greater than 255 */
    /* @Then it should throw an error */
    assertThrows(() => new Ip("192.168.15.256"), Error, "between 0 and 255");
  });

  it("should reject an incomplete address", () => {
    /* @Given an incomplete address */
    /* @Then it should throw an error */
    assertThrows(() => new Ip("192.168.15"), Error, "valid IPv4");
  });
});

describe("Gateway", () => {
  it("should accept a valid IPv4 address", () => {
    /* @Given a valid gateway */
    const gw = new Gateway("192.168.15.1");
    /* @Then it should store the value */
    assertEquals(gw.value, "192.168.15.1");
  });

  it("should reject an empty string", () => {
    /* @Given an empty string */
    /* @Then it should throw an error */
    assertThrows(() => new Gateway(""), Error, "gateway is required");
  });

  it("should reject an invalid format", () => {
    /* @Given an invalid format */
    /* @Then it should throw an error */
    assertThrows(() => new Gateway("abc"), Error, "valid IPv4");
  });
});

describe("Dns", () => {
  it("should accept a valid IPv4 address", () => {
    /* @Given a valid dns */
    const dns = new Dns("8.8.8.8");
    /* @Then it should store the value */
    assertEquals(dns.value, "8.8.8.8");
  });

  it("should reject an empty string", () => {
    /* @Given an empty string */
    /* @Then it should throw an error */
    assertThrows(() => new Dns(""), Error, "dns is required");
  });

  it("should reject an invalid format", () => {
    /* @Given an invalid format */
    /* @Then it should throw an error */
    assertThrows(() => new Dns("not.valid"), Error, "valid IPv4");
  });
});

describe("Network", () => {
  it("should create with ip, gateway and dns", () => {
    /* @Given ip, gateway and dns */
    const network = new Network(
      new Ip("192.168.15.100"),
      new Gateway("192.168.15.1"),
      new Dns("192.168.15.1"),
    );
    /* @Then all fields should be filled */
    assertEquals(network.ip.value, "192.168.15.100");
    assertEquals(network.gateway.value, "192.168.15.1");
    assertEquals(network.dns.value, "192.168.15.1");
  });
});
