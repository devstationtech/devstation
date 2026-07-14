import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { RegisterImageMcpEndpoint } from "@server/images/inbound/mcp/register/endpoint.ts";
import { UpdateImageMcpEndpoint } from "@server/images/inbound/mcp/update/endpoint.ts";
import { UnregisterImageMcpEndpoint } from "@server/images/inbound/mcp/unregister/endpoint.ts";
import { ListImagesMcpEndpoint } from "@server/images/inbound/mcp/list/endpoint.ts";
import type { RegisterImageHandler } from "@server/images/application/handlers/register-image-handler.ts";
import type { UpdateImageHandler } from "@server/images/application/handlers/update-image-handler.ts";
import type { UnregisterImageHandler } from "@server/images/application/handlers/unregister-image-handler.ts";
import type { Query as AllImagesQuery } from "@server/images/application/queries/all/query.ts";
import type { RegisterImage } from "@server/images/application/commands/register-image.ts";
import type { UpdateImage } from "@server/images/application/commands/update-image.ts";
import type { UnregisterImage } from "@server/images/application/commands/unregister-image.ts";

/**
 * Pins the wire metadata + dispatch glue for all four image MCP endpoints.
 * Handler-direct (no MCP policy guard on the images BC).
 */
// deno-lint-ignore no-explicit-any
type Anyish = any;

function fakeRegisterHandler(): { handler: RegisterImageHandler; calls: RegisterImage[] } {
  const calls: RegisterImage[] = [];
  const handler = {
    handle(cmd: RegisterImage): Promise<{ imageId: string }> {
      calls.push(cmd);
      return Promise.resolve({ imageId: "img-fake-1" });
    },
  } as Anyish as RegisterImageHandler;
  return { handler, calls };
}
function fakeUpdateHandler(): { handler: UpdateImageHandler; calls: UpdateImage[] } {
  const calls: UpdateImage[] = [];
  const handler = {
    handle(cmd: UpdateImage): Promise<void> {
      calls.push(cmd);
      return Promise.resolve();
    },
  } as Anyish as UpdateImageHandler;
  return { handler, calls };
}
function fakeRemoveHandler(): { handler: UnregisterImageHandler; calls: UnregisterImage[] } {
  const calls: UnregisterImage[] = [];
  const handler = {
    handle(cmd: UnregisterImage): Promise<void> {
      calls.push(cmd);
      return Promise.resolve();
    },
  } as Anyish as UnregisterImageHandler;
  return { handler, calls };
}
function fakeAllImagesQuery(records: unknown[]): AllImagesQuery {
  return { execute: () => Promise.resolve(records) } as Anyish;
}

describe("RegisterImageMcpEndpoint", () => {
  it("declares mutating wire metadata", () => {
    const { handler } = fakeRegisterHandler();
    const endpoint = new RegisterImageMcpEndpoint(handler);
    assertEquals(endpoint.name, "devstation_image_register");
    assertEquals(endpoint.risk, "mutating");
    assertEquals(endpoint.inputSchema.type, "object");
  });

  it("builds RegisterImage with all args and echoes the new image id", async () => {
    const { handler, calls } = fakeRegisterHandler();
    const endpoint = new RegisterImageMcpEndpoint(handler);
    const result = await endpoint.dispatch({
      name: "ubuntu-2204",
      os: "ubuntu-22-04",
      sourceUrl: "https://x/a.img",
      user: "alice",
      hostname: "server01",
    });
    assertEquals(calls.length, 1);
    assertEquals(calls[0].name, "ubuntu-2204");
    assertEquals(calls[0].os, "ubuntu-22-04");
    assertEquals(calls[0].sourceUrl, "https://x/a.img");
    assertEquals(calls[0].user, "alice");
    assertEquals(calls[0].host, "server01");
    assertEquals(result, { imageId: "img-fake-1", name: "ubuntu-2204" });
  });
});

describe("UpdateImageMcpEndpoint", () => {
  it("declares mutating wire metadata", () => {
    const { handler } = fakeUpdateHandler();
    const endpoint = new UpdateImageMcpEndpoint(handler);
    assertEquals(endpoint.name, "devstation_image_update");
    assertEquals(endpoint.risk, "mutating");
  });

  it("builds UpdateImage with all args and returns {}", async () => {
    const { handler, calls } = fakeUpdateHandler();
    const endpoint = new UpdateImageMcpEndpoint(handler);
    const result = await endpoint.dispatch({
      id: "img-1",
      name: "ubuntu-2204",
      os: "debian-12",
      sourceUrl: "https://x/b.img",
    });
    assertEquals(calls.length, 1);
    assertEquals(calls[0].id, "img-1");
    assertEquals(calls[0].os, "debian-12");
    assertEquals(calls[0].sourceUrl, "https://x/b.img");
    assertEquals(result, {});
  });
});

describe("UnregisterImageMcpEndpoint", () => {
  it("declares destructive wire metadata", () => {
    const { handler } = fakeRemoveHandler();
    const endpoint = new UnregisterImageMcpEndpoint(handler);
    assertEquals(endpoint.name, "devstation_image_unregister");
    assertEquals(endpoint.risk, "destructive");
  });

  it("builds UnregisterImage with the id and returns {}", async () => {
    const { handler, calls } = fakeRemoveHandler();
    const endpoint = new UnregisterImageMcpEndpoint(handler);
    const result = await endpoint.dispatch({ id: "img-1" });
    assertEquals(calls.length, 1);
    assertEquals(calls[0].id, "img-1");
    assertEquals(result, {});
  });
});

describe("ListImagesMcpEndpoint", () => {
  it("declares read wire metadata", () => {
    const endpoint = new ListImagesMcpEndpoint(fakeAllImagesQuery([]));
    assertEquals(endpoint.name, "devstation_image_list");
    assertEquals(endpoint.risk, "read");
  });

  it("returns the records the AllImagesQuery yields", async () => {
    const records = [
      {
        id: "i1",
        name: "ubuntu-2204",
        os: "ubuntu-22-04",
        sourceUrl: "https://x/a.img",
        version: 1,
        usages: [],
      },
    ];
    const endpoint = new ListImagesMcpEndpoint(fakeAllImagesQuery(records));
    const result = await endpoint.dispatch();
    assertEquals(result, records);
  });
});
