import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { RegisterSizeMcpEndpoint } from "@server/size/inbound/mcp/register/endpoint.ts";
import { UnregisterSizeMcpEndpoint } from "@server/size/inbound/mcp/unregister/endpoint.ts";
import { ListSizesMcpEndpoint } from "@server/size/inbound/mcp/list/endpoint.ts";
import type { RegisterSizeHandler } from "@server/size/application/handlers/register-size-handler.ts";
import type { UnregisterSizeHandler } from "@server/size/application/handlers/unregister-size-handler.ts";
import type { Query as AllSizesQuery } from "@server/size/application/queries/all/query.ts";
import type { RegisterSize } from "@server/size/application/commands/register-size.ts";
import type { UnregisterSize } from "@server/size/application/commands/unregister-size.ts";

/**
 * Pins the wire metadata and dispatch glue for all three size
 * MCP endpoints. No policy calls: size BC has no MCP policy guard.
 */

// deno-lint-ignore no-explicit-any
type Anyish = any;

function fakeRegisterSizeHandler(): {
  handler: RegisterSizeHandler;
  calls: RegisterSize[];
} {
  const calls: RegisterSize[] = [];
  const handler = {
    handle(cmd: RegisterSize): Promise<{ sizeId: string }> {
      calls.push(cmd);
      return Promise.resolve({ sizeId: "def-fake-1" });
    },
  } as Anyish as RegisterSizeHandler;
  return { handler, calls };
}

function fakeUnregisterSizeHandler(): {
  handler: UnregisterSizeHandler;
  calls: UnregisterSize[];
} {
  const calls: UnregisterSize[] = [];
  const handler = {
    handle(cmd: UnregisterSize): Promise<void> {
      calls.push(cmd);
      return Promise.resolve();
    },
  } as Anyish as UnregisterSizeHandler;
  return { handler, calls };
}

function fakeAllSizesQuery(records: unknown[]): AllSizesQuery {
  return { execute: () => Promise.resolve(records) } as Anyish;
}

// ─── RegisterSizeMcpEndpoint ───────────────────────────────────────────

describe("RegisterSizeMcpEndpoint", () => {
  it("declares mutating wire metadata", () => {
    /* @Given */
    const { handler } = fakeRegisterSizeHandler();
    const endpoint = new RegisterSizeMcpEndpoint(handler);
    /* @Then */
    assertEquals(endpoint.name, "devstation_size_register");
    assertEquals(endpoint.risk, "mutating");
    assertEquals(endpoint.inputSchema.type, "object");
  });

  it("builds RegisterSize with all args and echoes the new size id", async () => {
    /* @Given */
    const { handler, calls } = fakeRegisterSizeHandler();
    const endpoint = new RegisterSizeMcpEndpoint(handler);
    const args = {
      name: "medium",
      provider: "proxmox",
      cpu: 4,
      ram: 8192,
      disk: 50,
      user: "alice",
      hostname: "server01",
    };

    /* @When */
    const result = await endpoint.dispatch(args);

    /* @Then */
    assertEquals(calls.length, 1);
    assertEquals(calls[0].name, "medium");
    assertEquals(calls[0].provider, "proxmox");
    assertEquals(calls[0].cpu, 4);
    assertEquals(calls[0].ram, 8192);
    assertEquals(calls[0].disk, 50);
    assertEquals(calls[0].user, "alice");
    assertEquals(calls[0].host, "server01");
    // The id is echoed back so the caller can use the new size
    // immediately without listing first.
    assertEquals(result, { sizeId: "def-fake-1", name: "medium" });
  });
});

// ─── UnregisterSizeMcpEndpoint ─────────────────────────────────────────

describe("UnregisterSizeMcpEndpoint", () => {
  it("declares destructive wire metadata", () => {
    /* @Given */
    const { handler } = fakeUnregisterSizeHandler();
    const endpoint = new UnregisterSizeMcpEndpoint(handler);
    /* @Then */
    assertEquals(endpoint.name, "devstation_size_unregister");
    assertEquals(endpoint.risk, "destructive");
    assertEquals(endpoint.inputSchema.type, "object");
  });

  it("builds UnregisterSize with sizeId and returns {}", async () => {
    /* @Given */
    const { handler, calls } = fakeUnregisterSizeHandler();
    const endpoint = new UnregisterSizeMcpEndpoint(handler);

    /* @When */
    const result = await endpoint.dispatch({ sizeId: "def-medium" });

    /* @Then */
    assertEquals(calls.length, 1);
    assertEquals(calls[0].id, "def-medium");
    assertEquals(result, {});
  });
});

// ─── ListSizesMcpEndpoint ───────────────────────────────────────────────

describe("ListSizesMcpEndpoint", () => {
  it("declares read wire metadata", () => {
    /* @Given */
    const endpoint = new ListSizesMcpEndpoint(fakeAllSizesQuery([]));
    /* @Then */
    assertEquals(endpoint.name, "devstation_size_list");
    assertEquals(endpoint.risk, "read");
    assertEquals(endpoint.inputSchema.type, "object");
  });

  it("returns the records the AllSizesQuery yields", async () => {
    /* @Given */
    const records = [
      { id: "d1", name: "small", provider: "proxmox", cpu: 2, ram: 4096, disk: 20 },
      { id: "d2", name: "large", provider: "proxmox", cpu: 8, ram: 16384, disk: 100 },
    ];
    const endpoint = new ListSizesMcpEndpoint(fakeAllSizesQuery(records));

    /* @When */
    const result = await endpoint.dispatch();

    /* @Then */
    assertEquals(result, records);
  });
});
