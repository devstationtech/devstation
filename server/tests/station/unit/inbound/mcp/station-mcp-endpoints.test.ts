import { assertEquals, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { ListStationsMcpEndpoint } from "@server/station/inbound/mcp/list/endpoint.ts";
import { StationByIdMcpEndpoint } from "@server/station/inbound/mcp/by-id/endpoint.ts";
import { InstallStationMcpEndpoint } from "@server/station/inbound/mcp/install/endpoint.ts";
import { RegisterStationMcpEndpoint } from "@server/station/inbound/mcp/register/endpoint.ts";
import { UpdateStationMcpEndpoint } from "@server/station/inbound/mcp/update/endpoint.ts";
import { UnregisterStationMcpEndpoint } from "@server/station/inbound/mcp/unregister/endpoint.ts";
import { RegisterServiceMcpEndpoint } from "@server/station/inbound/mcp/services/register/endpoint.ts";
import { UnregisterServiceMcpEndpoint } from "@server/station/inbound/mcp/services/unregister/endpoint.ts";
import { ServicesByBlueprintMcpEndpoint } from "@server/station/inbound/mcp/services/by-blueprint/endpoint.ts";
import { ServiceByIdMcpEndpoint } from "@server/station/inbound/mcp/services/by-id/endpoint.ts";
import { ServicesByStationMcpEndpoint } from "@server/station/inbound/mcp/services/by-station/endpoint.ts";
import { McpPolicy } from "@server/shared/inbound/mcp/policy/mcp-policy.ts";
import { PolicyViolation } from "@server/shared/inbound/mcp/policy/violation.ts";
import { StationNotFound } from "@server/station/domain/exceptions/station-not-found.ts";
import type { Query as AllStationsQuery } from "@server/station/application/queries/all/query.ts";
import type { Query as StationByIdQuery } from "@server/station/application/queries/by-id/query.ts";
import type { Query as ServicesByBlueprintQuery } from "@server/station/application/queries/services/by-blueprint/query.ts";
import type { Query as ServiceByIdQuery } from "@server/station/application/queries/services/by-id/query.ts";
import type { Query as ServicesByStationQuery } from "@server/station/application/queries/services/by-station/query.ts";
import type { InstallStationHandler } from "@server/station/application/handlers/install-station-handler.ts";
import type { InstallStation } from "@server/station/application/commands/install-station.ts";
import type { RegisterStationHandler } from "@server/station/application/handlers/register-station-handler.ts";
import type { RegisterStation } from "@server/station/application/commands/register-station.ts";
import type { UpdateStationHandler } from "@server/station/application/handlers/update-station-handler.ts";
import type { UpdateStation } from "@server/station/application/commands/update-station.ts";
import type { UnregisterStationHandler } from "@server/station/application/handlers/unregister-station-handler.ts";
import type { UnregisterStation } from "@server/station/application/commands/unregister-station.ts";
import type { RegisterServiceHandler } from "@server/station/application/handlers/register-service-handler.ts";
import type { RegisterService } from "@server/station/application/commands/register-service.ts";
import type { UnregisterServiceHandler } from "@server/station/application/handlers/unregister-service-handler.ts";
import type { UnregisterService } from "@server/station/application/commands/unregister-service.ts";

/**
 * Pins the station MCP endpoint shapes: read (delegates to query),
 * policy-guarded mutating (resolves name then guards), and the
 * policy-guard contract for `requirePrefix` (station install uses
 * prefix-only; stations have no per-cluster allowlist equivalent).
 */

// deno-lint-ignore no-explicit-any
type Anyish = any;

function fakeAllStationsQuery(records: unknown[]): AllStationsQuery {
  return { execute: () => Promise.resolve(records) } as Anyish;
}

function fakeStationByIdQuery(record: { name: string } | null): StationByIdQuery {
  return { execute: () => Promise.resolve(record) } as Anyish;
}

function fakeInstallHandler(): { handler: InstallStationHandler; calls: InstallStation[] } {
  const calls: InstallStation[] = [];
  const handler = {
    handle(cmd: InstallStation): Promise<string> {
      calls.push(cmd);
      return Promise.resolve("exec-install");
    },
  } as Anyish as InstallStationHandler;
  return { handler, calls };
}

describe("ListStationsMcpEndpoint", () => {
  it("returns the records the AllStationsQuery yields (no gateway)", async () => {
    /* @Given a fake query that yields two records */
    const endpoint = new ListStationsMcpEndpoint(fakeAllStationsQuery([
      { id: "s1", name: "homelab-dev" },
      { id: "s2", name: "prod" },
    ]));
    /* @When dispatch runs */
    const result = await endpoint.dispatch();
    /* @Then the records pass through unchanged */
    assertEquals(result, [
      { id: "s1", name: "homelab-dev" },
      { id: "s2", name: "prod" },
    ]);
  });
});

describe("StationByIdMcpEndpoint", () => {
  it("throws when the id is missing (registry maps to isError)", async () => {
    const endpoint = new StationByIdMcpEndpoint(fakeStationByIdQuery(null));
    await assertRejects(() => endpoint.dispatch({ id: "missing" }), Error, "not found");
  });

  it("returns the record when present", async () => {
    const endpoint = new StationByIdMcpEndpoint(
      fakeStationByIdQuery({ name: "homelab-dev" } as Anyish),
    );
    const out = await endpoint.dispatch({ id: "s1" });
    assertEquals((out as { name: string }).name, "homelab-dev");
  });
});

describe("InstallStationMcpEndpoint (long-running + policy guard)", () => {
  it("calls policy.requirePrefix on the resolved station name BEFORE the handler", async () => {
    /* @Given a policy with a prefix, a station whose name does NOT carry it */
    const { handler, calls } = fakeInstallHandler();
    const endpoint = new InstallStationMcpEndpoint(
      handler,
      fakeStationByIdQuery({ name: "prod-station" }),
    );
    const policy = McpPolicy.load("prefix:ds-e2e-");

    /* @When dispatch runs */
    /* @Then PolicyViolation — handler must NOT have been called */
    await assertRejects(
      () =>
        endpoint.dispatch(
          { stationId: "s1", serviceIds: ["svc-1"] },
          { policy },
        ),
      PolicyViolation,
      "prefix",
    );
    assertEquals(calls.length, 0);
  });

  it("throws StationNotFound (not a policy violation) when the station does not exist", async () => {
    /* @Given a policy that would reject, and a station id that resolves to nothing */
    const { handler, calls } = fakeInstallHandler();
    const endpoint = new InstallStationMcpEndpoint(handler, fakeStationByIdQuery(null));
    const policy = McpPolicy.load("prefix:ds-e2e-");

    /* @When dispatch runs against the missing station */
    /* @Then the caller hears the plain not-found — not a confusing policy refusal —
       and the handler is never reached */
    await assertRejects(
      () => endpoint.dispatch({ stationId: "ghost", serviceIds: ["svc-1"] }, { policy }),
      StationNotFound,
      "not found",
    );
    assertEquals(calls.length, 0);
  });

  it("allows dispatch when the station name carries the prefix; returns executionId", async () => {
    const { handler, calls } = fakeInstallHandler();
    const endpoint = new InstallStationMcpEndpoint(
      handler,
      fakeStationByIdQuery({ name: "ds-e2e-lab" }),
    );
    const policy = McpPolicy.load("prefix:ds-e2e-");

    const result = await endpoint.dispatch(
      { stationId: "s1", serviceIds: ["svc-1", "svc-2"] },
      { policy },
    );

    assertEquals(calls.length, 1);
    assertEquals(calls[0].stationId, "s1");
    assertEquals([...calls[0].serviceIds], ["svc-1", "svc-2"]);
    assertEquals(result, { executionId: "exec-install" });
  });

  it("is a no-op for an OFF policy (full feature exposure default)", async () => {
    const { handler, calls } = fakeInstallHandler();
    const endpoint = new InstallStationMcpEndpoint(
      handler,
      fakeStationByIdQuery({ name: "anything" }),
    );
    const result = await endpoint.dispatch(
      { stationId: "s1", serviceIds: ["svc-1"] },
      { policy: McpPolicy.OFF },
    );
    assertEquals(calls.length, 1);
    assertEquals(result, { executionId: "exec-install" });
  });
});

// ─── Factories for new endpoints ─────────────────────────────────────────────

function fakeRegisterStationHandler(): {
  handler: RegisterStationHandler;
  calls: RegisterStation[];
} {
  const calls: RegisterStation[] = [];
  const handler = {
    handle(cmd: RegisterStation): Promise<{ stationId: string }> {
      calls.push(cmd);
      return Promise.resolve({ stationId: "stn-fake-1" });
    },
  } as Anyish as RegisterStationHandler;
  return { handler, calls };
}

function fakeUpdateStationHandler(): {
  handler: UpdateStationHandler;
  calls: UpdateStation[];
} {
  const calls: UpdateStation[] = [];
  const handler = {
    handle(cmd: UpdateStation): Promise<void> {
      calls.push(cmd);
      return Promise.resolve();
    },
  } as Anyish as UpdateStationHandler;
  return { handler, calls };
}

function fakeUnregisterStationHandler(): {
  handler: UnregisterStationHandler;
  calls: UnregisterStation[];
} {
  const calls: UnregisterStation[] = [];
  const handler = {
    handle(cmd: UnregisterStation): Promise<void> {
      calls.push(cmd);
      return Promise.resolve();
    },
  } as Anyish as UnregisterStationHandler;
  return { handler, calls };
}

function fakeRegisterServiceHandler(): {
  handler: RegisterServiceHandler;
  calls: RegisterService[];
} {
  const calls: RegisterService[] = [];
  const handler = {
    handle(cmd: RegisterService): Promise<void> {
      calls.push(cmd);
      return Promise.resolve();
    },
  } as Anyish as RegisterServiceHandler;
  return { handler, calls };
}

function fakeUnregisterServiceHandler(): {
  handler: UnregisterServiceHandler;
  calls: UnregisterService[];
} {
  const calls: UnregisterService[] = [];
  const handler = {
    handle(cmd: UnregisterService): Promise<void> {
      calls.push(cmd);
      return Promise.resolve();
    },
  } as Anyish as UnregisterServiceHandler;
  return { handler, calls };
}

function fakeServicesByBlueprintQuery(records: unknown[]): ServicesByBlueprintQuery {
  return { execute: (_bp: string) => Promise.resolve(records) } as Anyish;
}

function fakeServiceByIdQuery(record: unknown | null): ServiceByIdQuery {
  return { execute: (_id: string) => Promise.resolve(record) } as Anyish;
}

function fakeServicesByStationQuery(records: unknown[]): ServicesByStationQuery {
  return { execute: (_sid: string) => Promise.resolve(records) } as Anyish;
}

// ─── RegisterStationMcpEndpoint ───────────────────────────────────────────────

describe("RegisterStationMcpEndpoint (mutating + name-based policy guard)", () => {
  it("declares the wire metadata (name, risk, schema)", () => {
    const { handler } = fakeRegisterStationHandler();
    const endpoint = new RegisterStationMcpEndpoint(handler);
    assertEquals(endpoint.name, "devstation_station_register");
    assertEquals(endpoint.risk, "mutating");
    assertEquals(endpoint.inputSchema.type, "object");
  });

  it("refuses when station name does NOT carry the policy prefix", async () => {
    const { handler, calls } = fakeRegisterStationHandler();
    const endpoint = new RegisterStationMcpEndpoint(handler);
    await assertRejects(
      () =>
        endpoint.dispatch(
          { name: "prod-station", description: "d", user: "u", hostname: "h" },
          { policy: McpPolicy.load("prefix:ds-e2e-") },
        ),
      PolicyViolation,
      "prefix",
    );
    assertEquals(calls.length, 0);
  });

  it("registers the station with a matching prefix", async () => {
    const { handler, calls } = fakeRegisterStationHandler();
    const endpoint = new RegisterStationMcpEndpoint(handler);
    const result = await endpoint.dispatch(
      { name: "ds-e2e-lab", description: "my lab", user: "alice", hostname: "box1" },
      { policy: McpPolicy.load("prefix:ds-e2e-") },
    );
    assertEquals(calls.length, 1);
    assertEquals(calls[0].name, "ds-e2e-lab");
    assertEquals(calls[0].description, "my lab");
    // The new entity id is echoed back so the caller can chain
    // follow-up tools without a second list call.
    assertEquals(result, { stationId: "stn-fake-1", name: "ds-e2e-lab" });
  });

  it("registers with OFF policy (full exposure default)", async () => {
    const { handler, calls } = fakeRegisterStationHandler();
    const endpoint = new RegisterStationMcpEndpoint(handler);
    const result = await endpoint.dispatch(
      { name: "anything", description: "d", user: "u", hostname: "h" },
      { policy: McpPolicy.OFF },
    );
    assertEquals(calls.length, 1);
    assertEquals(result, { stationId: "stn-fake-1", name: "anything" });
  });
});

// ─── UpdateStationMcpEndpoint ─────────────────────────────────────────────────

describe("UpdateStationMcpEndpoint (mutating + StationByIdQuery policy guard)", () => {
  it("declares the wire metadata (name, risk)", () => {
    const { handler } = fakeUpdateStationHandler();
    const endpoint = new UpdateStationMcpEndpoint(handler, fakeStationByIdQuery(null));
    assertEquals(endpoint.name, "devstation_station_update");
    assertEquals(endpoint.risk, "mutating");
  });

  it("refuses when resolved station name lacks the policy prefix", async () => {
    const { handler, calls } = fakeUpdateStationHandler();
    const endpoint = new UpdateStationMcpEndpoint(
      handler,
      fakeStationByIdQuery({ name: "prod-station" }),
    );
    await assertRejects(
      () =>
        endpoint.dispatch(
          { stationId: "s1", name: "new-name", description: "desc" },
          { policy: McpPolicy.load("prefix:ds-e2e-") },
        ),
      PolicyViolation,
      "prefix",
    );
    assertEquals(calls.length, 0);
  });

  it("updates when name carries the prefix", async () => {
    const { handler, calls } = fakeUpdateStationHandler();
    const endpoint = new UpdateStationMcpEndpoint(
      handler,
      fakeStationByIdQuery({ name: "ds-e2e-lab" }),
    );
    const result = await endpoint.dispatch(
      { stationId: "s1", name: "ds-e2e-lab-renamed", description: "new desc" },
      { policy: McpPolicy.load("prefix:ds-e2e-") },
    );
    assertEquals(calls.length, 1);
    assertEquals(calls[0].stationId, "s1");
    assertEquals(calls[0].name, "ds-e2e-lab-renamed");
    assertEquals(result, {});
  });
});

// ─── UnregisterStationMcpEndpoint ─────────────────────────────────────────────────

describe("UnregisterStationMcpEndpoint (destructive + StationByIdQuery policy guard)", () => {
  it("declares the wire metadata (name, risk)", () => {
    const { handler } = fakeUnregisterStationHandler();
    const endpoint = new UnregisterStationMcpEndpoint(handler, fakeStationByIdQuery(null));
    assertEquals(endpoint.name, "devstation_station_unregister");
    assertEquals(endpoint.risk, "destructive");
  });

  it("refuses when resolved station name lacks the policy prefix", async () => {
    const { handler, calls } = fakeUnregisterStationHandler();
    const endpoint = new UnregisterStationMcpEndpoint(
      handler,
      fakeStationByIdQuery({ name: "prod-station" }),
    );
    await assertRejects(
      () => endpoint.dispatch({ stationId: "s1" }, { policy: McpPolicy.load("prefix:ds-e2e-") }),
      PolicyViolation,
      "prefix",
    );
    assertEquals(calls.length, 0);
  });

  it("unregisters with OFF policy", async () => {
    const { handler, calls } = fakeUnregisterStationHandler();
    const endpoint = new UnregisterStationMcpEndpoint(
      handler,
      fakeStationByIdQuery({ name: "anything" }),
    );
    const result = await endpoint.dispatch({ stationId: "s1" }, { policy: McpPolicy.OFF });
    assertEquals(calls.length, 1);
    assertEquals(calls[0].stationId, "s1");
    assertEquals(result, {});
  });
});

// ─── RegisterServiceMcpEndpoint ───────────────────────────────────────────────

describe("RegisterServiceMcpEndpoint (mutating + StationByIdQuery policy guard)", () => {
  const serviceArgs = {
    stationId: "s1",
    name: "my-svc",
    blueprint: "bp-nginx",
    vaultId: "v1",
    inputs: { port: 8080 },
    secrets: { token: "sec-1" },
    user: "alice",
    hostname: "box1",
    instances: [
      {
        role: "server",
        host: "192.168.1.10",
        credentialVaultId: "v1",
        usernameSecretId: "u1",
        passwordSecretId: "p1",
      },
    ],
  };

  it("declares the wire metadata (name, risk)", () => {
    const { handler } = fakeRegisterServiceHandler();
    const endpoint = new RegisterServiceMcpEndpoint(handler, fakeStationByIdQuery(null));
    assertEquals(endpoint.name, "devstation_station_service_register");
    assertEquals(endpoint.risk, "mutating");
  });

  it("refuses when station name lacks the policy prefix", async () => {
    const { handler, calls } = fakeRegisterServiceHandler();
    const endpoint = new RegisterServiceMcpEndpoint(
      handler,
      fakeStationByIdQuery({ name: "prod-station" }),
    );
    await assertRejects(
      () => endpoint.dispatch(serviceArgs, { policy: McpPolicy.load("prefix:ds-e2e-") }),
      PolicyViolation,
      "prefix",
    );
    assertEquals(calls.length, 0);
  });

  it("registers the service with OFF policy", async () => {
    const { handler, calls } = fakeRegisterServiceHandler();
    const endpoint = new RegisterServiceMcpEndpoint(
      handler,
      fakeStationByIdQuery({ name: "ds-e2e-lab" }),
    );
    const result = await endpoint.dispatch(serviceArgs, { policy: McpPolicy.OFF });
    assertEquals(calls.length, 1);
    assertEquals(calls[0].stationId, "s1");
    assertEquals(calls[0].name, "my-svc");
    assertEquals(calls[0].blueprint, "bp-nginx");
    assertEquals(result, {});
  });
});

// ─── UnregisterServiceMcpEndpoint ─────────────────────────────────────────────────

describe("UnregisterServiceMcpEndpoint (destructive + StationByIdQuery policy guard)", () => {
  it("declares the wire metadata (name, risk)", () => {
    const { handler } = fakeUnregisterServiceHandler();
    const endpoint = new UnregisterServiceMcpEndpoint(handler, fakeStationByIdQuery(null));
    assertEquals(endpoint.name, "devstation_station_service_unregister");
    assertEquals(endpoint.risk, "destructive");
  });

  it("refuses when station name lacks the policy prefix", async () => {
    const { handler, calls } = fakeUnregisterServiceHandler();
    const endpoint = new UnregisterServiceMcpEndpoint(
      handler,
      fakeStationByIdQuery({ name: "prod-station" }),
    );
    await assertRejects(
      () =>
        endpoint.dispatch(
          { stationId: "s1", serviceId: "svc-1" },
          { policy: McpPolicy.load("prefix:ds-e2e-") },
        ),
      PolicyViolation,
      "prefix",
    );
    assertEquals(calls.length, 0);
  });

  it("unregisters the service with OFF policy", async () => {
    const { handler, calls } = fakeUnregisterServiceHandler();
    const endpoint = new UnregisterServiceMcpEndpoint(
      handler,
      fakeStationByIdQuery({ name: "anything" }),
    );
    const result = await endpoint.dispatch(
      { stationId: "s1", serviceId: "svc-1" },
      { policy: McpPolicy.OFF },
    );
    assertEquals(calls.length, 1);
    assertEquals(calls[0].stationId, "s1");
    assertEquals(calls[0].serviceId, "svc-1");
    assertEquals(result, {});
  });
});

// ─── ServicesByBlueprintMcpEndpoint ──────────────────────────────────────────

describe("ServicesByBlueprintMcpEndpoint (read, no policy)", () => {
  it("returns the records the ServicesByBlueprintQuery yields", async () => {
    const endpoint = new ServicesByBlueprintMcpEndpoint(
      fakeServicesByBlueprintQuery([{ id: "svc-1", blueprint: "bp-nginx" }]),
    );
    const result = await endpoint.dispatch({ blueprint: "bp-nginx" });
    assertEquals(result, [{ id: "svc-1", blueprint: "bp-nginx" }]);
  });

  it("declares read risk and the expected wire name", () => {
    const endpoint = new ServicesByBlueprintMcpEndpoint(fakeServicesByBlueprintQuery([]));
    assertEquals(endpoint.name, "devstation_station_services_by_blueprint");
    assertEquals(endpoint.risk, "read");
  });
});

// ─── ServiceByIdMcpEndpoint ───────────────────────────────────────────────────

describe("ServiceByIdMcpEndpoint (read, no policy)", () => {
  it("throws when the id is missing", async () => {
    const endpoint = new ServiceByIdMcpEndpoint(fakeServiceByIdQuery(null));
    await assertRejects(() => endpoint.dispatch({ id: "missing" }), Error, "not found");
  });

  it("returns the record when present", async () => {
    const endpoint = new ServiceByIdMcpEndpoint(
      fakeServiceByIdQuery({ id: "svc-1", name: "nginx" }),
    );
    const result = await endpoint.dispatch({ id: "svc-1" });
    assertEquals((result as { name: string }).name, "nginx");
  });

  it("declares read risk and the expected wire name", () => {
    const endpoint = new ServiceByIdMcpEndpoint(fakeServiceByIdQuery(null));
    assertEquals(endpoint.name, "devstation_station_service_get");
    assertEquals(endpoint.risk, "read");
  });
});

// ─── ServicesByStationMcpEndpoint ─────────────────────────────────────────────

describe("ServicesByStationMcpEndpoint (read, no policy)", () => {
  it("returns the records the ServicesByStationQuery yields", async () => {
    const endpoint = new ServicesByStationMcpEndpoint(
      fakeServicesByStationQuery([{ id: "svc-1", stationId: "s1" }]),
    );
    const result = await endpoint.dispatch({ stationId: "s1" });
    assertEquals(result, [{ id: "svc-1", stationId: "s1" }]);
  });

  it("declares read risk and the expected wire name", () => {
    const endpoint = new ServicesByStationMcpEndpoint(fakeServicesByStationQuery([]));
    assertEquals(endpoint.name, "devstation_station_services_by_station");
    assertEquals(endpoint.risk, "read");
  });
});
