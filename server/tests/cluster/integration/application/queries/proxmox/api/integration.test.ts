import { assertEquals, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { ProxmoxIntegration } from "@server/cluster/application/queries/proxmox/api/integration.ts";

const HOST = "192.168.15.100";
const TOKEN = "root@pam!monitoring=test-secret";

const originalFetch = globalThis.fetch;

function mockFetch(body: string, httpStatus = 200): void {
  globalThis.fetch = () =>
    Promise.resolve(
      new Response(body, { status: httpStatus, headers: { "content-type": "application/json" } }),
    );
}

function mockFetchFailure(message: string): void {
  globalThis.fetch = () => Promise.reject(new TypeError(message));
}

function restoreFetch(): void {
  globalThis.fetch = originalFetch;
}

/**
 * Captures the URL the HttpClient was asked to hit, so we can assert
 * the constructor built it without double-appending the port. Returns
 * the array fetch will populate as calls happen.
 */
function captureFetchUrls(body = '{"data":[]}'): string[] {
  const seen: string[] = [];
  globalThis.fetch = (input) => {
    seen.push(typeof input === "string" ? input : input.toString());
    return Promise.resolve(
      new Response(body, { status: 200, headers: { "content-type": "application/json" } }),
    );
  };
  return seen;
}

describe("ProxmoxIntegration — host normalization", () => {
  it("plain host gets default port 8006 appended", async () => {
    const seen = captureFetchUrls();
    try {
      await new ProxmoxIntegration("192.168.15.100", TOKEN).clusterResources();
      assertEquals(seen[0], "https://192.168.15.100:8006/api2/json/cluster/resources");
    } finally {
      restoreFetch();
    }
  });

  it("host that already includes :port is NOT double-suffixed", async () => {
    const seen = captureFetchUrls();
    try {
      await new ProxmoxIntegration("192.168.15.100:8006", TOKEN).clusterResources();
      assertEquals(seen[0], "https://192.168.15.100:8006/api2/json/cluster/resources");
    } finally {
      restoreFetch();
    }
  });

  it("host with a non-default port keeps that port", async () => {
    const seen = captureFetchUrls();
    try {
      await new ProxmoxIntegration("proxmox.lan:8443", TOKEN).clusterResources();
      assertEquals(seen[0], "https://proxmox.lan:8443/api2/json/cluster/resources");
    } finally {
      restoreFetch();
    }
  });

  it("https:// prefix is stripped before composing the URL", async () => {
    const seen = captureFetchUrls();
    try {
      await new ProxmoxIntegration("https://pve.lan", TOKEN).clusterResources();
      assertEquals(seen[0], "https://pve.lan:8006/api2/json/cluster/resources");
    } finally {
      restoreFetch();
    }
  });

  it("bracketed IPv6 with port is preserved", async () => {
    const seen = captureFetchUrls();
    try {
      await new ProxmoxIntegration("[2001:db8::1]:8443", TOKEN).clusterResources();
      assertEquals(seen[0], "https://[2001:db8::1]:8443/api2/json/cluster/resources");
    } finally {
      restoreFetch();
    }
  });

  it("bracketed IPv6 without port gets default 8006", async () => {
    const seen = captureFetchUrls();
    try {
      await new ProxmoxIntegration("[2001:db8::1]", TOKEN).clusterResources();
      assertEquals(seen[0], "https://[2001:db8::1]:8006/api2/json/cluster/resources");
    } finally {
      restoreFetch();
    }
  });
});

describe("ProxmoxIntegration.clusterResources", () => {
  it("should return raw cluster resources", async () => {
    /* @Given a /cluster/resources response */
    mockFetch(JSON.stringify({
      data: [
        {
          type: "node",
          node: "pve1",
          status: "online",
          cpu: 0.23,
          maxcpu: 8,
          mem: 4294967296,
          maxmem: 17179869184,
        },
        { type: "qemu", node: "pve1", vmid: 1001, status: "running", cpu: 0.12, maxcpu: 2 },
      ],
    }));

    try {
      /* @When the resources are queried */
      const integration = new ProxmoxIntegration(HOST, TOKEN);
      const resources = await integration.clusterResources();

      /* @Then the raw resources should be returned */
      assertEquals(resources.length, 2);
      assertEquals(resources[0].type, "node");
      assertEquals(resources[0].node, "pve1");
      assertEquals(resources[0].cpu, 0.23);
      assertEquals(resources[1].type, "qemu");
      assertEquals(resources[1].vmid, 1001);
    } finally {
      restoreFetch();
    }
  });

  it("should throw on auth failure (401)", async () => {
    /* @Given a 401 response */
    mockFetch("", 401);

    try {
      /* @When the resources are queried */
      /* @Then an authentication error should be thrown */
      const integration = new ProxmoxIntegration(HOST, TOKEN);
      await assertRejects(() => integration.clusterResources(), Error, "authentication failed");
    } finally {
      restoreFetch();
    }
  });

  it("should throw on network failure", async () => {
    /* @Given a connection failure */
    mockFetchFailure("connection refused");

    try {
      /* @When the resources are queried */
      /* @Then an error should be thrown */
      const integration = new ProxmoxIntegration(HOST, TOKEN);
      await assertRejects(() => integration.clusterResources(), Error);
    } finally {
      restoreFetch();
    }
  });
});
