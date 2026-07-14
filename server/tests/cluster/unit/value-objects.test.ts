import { assertEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Ip } from "@server/cluster/domain/models/proxmox/nodes/ip.ts";
import { Gateway } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/network/gateway.ts";
import { Dns } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/network/dns.ts";
import { Network } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/network/network.ts";
import { Storage } from "@server/cluster/domain/models/proxmox/nodes/storage.ts";
import { VirtualMachineId } from "@server/cluster/domain/models/proxmox/virtual-machine-id.ts";
import { Url } from "@server/cluster/domain/models/proxmox/images/url.ts";
import { Size } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/size.ts";

/**
 * Cluster domain value objects — the IPv4 validation cluster (Ip,
 * Gateway, Dns) shares the same regex but lives in three different
 * VOs so each error message points at the right field. Tests pin
 * both the contract and the message focus.
 */

const VALID_IPV4 = ["10.0.0.1", "192.168.15.194", "255.255.255.255", "0.0.0.0"] as const;
const INVALID_IPV4 = [
  "256.0.0.1", // octet > 255
  "1.1.1", // missing octet
  "1.1.1.1.1", // extra octet
  "1.1.1.a", // non-numeric octet
  "1.1.1.", // trailing dot
  "::1", // ipv6
  "host.example.com", // hostname
] as const;

describe("Ip", () => {
  it("accepts a valid IPv4 dotted-quad", () => {
    for (const v of VALID_IPV4) assertEquals(new Ip(v).value, v);
  });

  it("rejects an empty value", () => {
    assertThrows(() => new Ip(""), Error, "required");
  });

  it("rejects malformed strings (wrong octet count, non-numeric, IPv6)", () => {
    for (const v of INVALID_IPV4) {
      /* @Given a value that isn't a dotted-quad IPv4 */
      /* @When Ip is constructed */
      /* @Then it throws with a "ip"-focused message */
      assertThrows(() => new Ip(v), Error, "ip");
    }
  });
});

describe("Gateway", () => {
  it("accepts a valid IPv4 dotted-quad", () => {
    assertEquals(new Gateway("192.168.15.1").value, "192.168.15.1");
  });

  it("rejects an empty value", () => {
    assertThrows(() => new Gateway(""), Error, "gateway is required");
  });

  it("rejects malformed values with a 'gateway'-focused message", () => {
    /* @Given a non-IPv4 string */
    /* @When Gateway is constructed */
    /* @Then it throws — the message says 'gateway', not 'ip', so the field is unambiguous */
    assertThrows(() => new Gateway("1.1.1"), Error, "gateway");
    assertThrows(() => new Gateway("300.0.0.1"), Error, "gateway");
  });
});

describe("Dns", () => {
  it("accepts a valid IPv4 dotted-quad", () => {
    assertEquals(new Dns("8.8.8.8").value, "8.8.8.8");
  });

  it("rejects an empty value", () => {
    assertThrows(() => new Dns(""), Error, "dns is required");
  });

  it("rejects malformed values with a 'dns'-focused message", () => {
    assertThrows(() => new Dns("1.1"), Error, "dns");
    assertThrows(() => new Dns("256.1.1.1"), Error, "dns");
  });
});

describe("Network composite", () => {
  it("composes Ip + Gateway + Dns and exposes them verbatim", () => {
    const ip = new Ip("192.168.15.100");
    const gw = new Gateway("192.168.15.1");
    const dns = new Dns("8.8.8.8");
    const network = new Network(ip, gw, dns);
    assertEquals(network.ip, ip);
    assertEquals(network.gateway, gw);
    assertEquals(network.dns, dns);
  });
});

describe("Storage", () => {
  it("accepts any non-empty string (Proxmox storage names vary widely)", () => {
    /* @Given Proxmox-style storage names */
    /* @Then any non-empty string is accepted — the BC doesn't enumerate names */
    assertEquals(new Storage("local-zfs").value, "local-zfs");
    assertEquals(new Storage("nvme-pool").value, "nvme-pool");
    assertEquals(new Storage("a").value, "a");
  });

  it("rejects an empty value", () => {
    assertThrows(() => new Storage(""), Error, "storage is required");
  });
});

describe("VirtualMachineId", () => {
  it("accepts integers >= 100 (Proxmox reserves 100+ for user VMs)", () => {
    assertEquals(new VirtualMachineId(100).value, 100);
    assertEquals(new VirtualMachineId(4001).value, 4001);
    assertEquals(new VirtualMachineId(999999).value, 999999);
  });

  it("rejects ids below 100 (system-reserved range)", () => {
    /* @Given an id in the reserved range */
    /* @When VirtualMachineId is constructed */
    /* @Then it throws — keeps user VMs from colliding with system ids */
    assertThrows(() => new VirtualMachineId(99), Error, "100");
    assertThrows(() => new VirtualMachineId(0), Error, "100");
    assertThrows(() => new VirtualMachineId(-1), Error, "100");
  });

  it("rejects non-integer ids (1.5, NaN)", () => {
    assertThrows(() => new VirtualMachineId(1.5), Error);
    assertThrows(() => new VirtualMachineId(NaN), Error);
  });
});

describe("Url", () => {
  it("accepts http and https URLs", () => {
    assertEquals(
      new Url("https://cloud-images.ubuntu.com/jammy/jammy-server.img").value,
      "https://cloud-images.ubuntu.com/jammy/jammy-server.img",
    );
    assertEquals(new Url("http://x").value, "http://x");
  });

  it("rejects an empty value", () => {
    assertThrows(() => new Url(""), Error, "url is required");
  });

  it("rejects schemes other than http/https (ftp, file, data, none)", () => {
    /* @Given any non-http(s) scheme */
    /* @When Url is constructed */
    /* @Then it throws — the image download path only supports HTTP */
    for (const v of ["ftp://x", "file:///tmp/x", "data:text/plain;base64,xx", "x"]) {
      assertThrows(() => new Url(v), Error, "http");
    }
  });
});

describe("VM Size", () => {
  it("accepts a non-empty size id reference", () => {
    /* @Given the id of a size the VM materialises */
    assertEquals(
      new Size("00000000-0000-0000-0000-000000000001").value,
      "00000000-0000-0000-0000-000000000001",
    );
  });

  it("rejects an empty value", () => {
    /* @Given an empty string */
    /* @When Size is constructed */
    /* @Then it throws — a VM must always reference the size it came from */
    assertThrows(() => new Size(""), Error, "size is required");
  });
});
