/// <reference types="@types/react" />
import { assert, assertStringIncludes } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { render } from "ink-testing-library";
import { StationDetailScreen } from "@ui/station/detail.tsx";
import { type RpcClients, RpcClientsProvider } from "@ui/rpc-clients-provider.tsx";
import { SessionProvider } from "@ui/auth/session-provider.tsx";
import type { StationServiceRecord } from "@jsonrpc-contracts-ts/station.gen.ts";

/**
 * Removing (unregistering) a service from a station is available in the TUI —
 * distinct from uninstalling it. `r remove` opens a confirm for a non-installed
 * service and calls `station.services.unregister`; an INSTALLED service is
 * blocked up front (the backend rejects it). Mirrors the rendered-screen
 * pattern (RpcClientsProvider seam + ink-testing-library).
 */

function svc(name: string, status: string): StationServiceRecord {
  return {
    id: name,
    name,
    blueprint: name,
    status,
    instances: [],
    host: null,
    lastInstalledAt: null,
  } as unknown as StationServiceRecord;
}

function mockClients(
  services: StationServiceRecord[],
  onUnregister: () => Promise<unknown>,
): RpcClients {
  return {
    station: {
      byId: () =>
        Promise.resolve({
          id: "st1",
          name: "homelab-qa",
          description: "",
          status: "REGISTERED",
          serviceCount: services.length,
          serviceStats: { registered: 1, installing: 0, installed: 0, failed: 0, aborted: 0 },
        }),
      servicesByStation: () => Promise.resolve(services),
      servicesUnregister: onUnregister,
    },
    operations: { watch: async function* () {} },
  } as unknown as RpcClients;
}

const session = { sessionId: crypto.randomUUID(), expiresAt: "2099-01-01T00:00:00.000Z" };
const flush = () => new Promise((r) => setTimeout(r, 40));

function setup(services: StationServiceRecord[], onUnregister: () => Promise<unknown>) {
  return render(
    <RpcClientsProvider clients={mockClients(services, onUnregister)}>
      <SessionProvider session={session}>
        <StationDetailScreen stationId="st1" onBack={() => {}} />
      </SessionProvider>
    </RpcClientsProvider>,
  );
}

describe("StationDetailScreen — remove service", () => {
  it("offers 'r remove' and opens a confirm for a non-installed service", async () => {
    const { stdin, lastFrame, unmount } = setup(
      [svc("everest", "REGISTERED")],
      () => Promise.resolve({}),
    );
    await flush();

    /* @Then the help bar advertises remove */
    assertStringIncludes(lastFrame() ?? "", "r remove");

    /* @When the user presses r on a REGISTERED (non-installed) service */
    stdin.write("r");
    await flush();

    /* @Then a remove confirm is shown for it */
    const frame = lastFrame() ?? "";
    assertStringIncludes(frame, "remove service");
    assertStringIncludes(frame, "everest");
    unmount();
  });

  it("blocks removing an INSTALLED service (must uninstall first)", async () => {
    const { stdin, lastFrame, unmount } = setup(
      [svc("docker", "INSTALLED")],
      () => Promise.reject(new Error("should not be called")),
    );
    await flush();

    /* @When the user presses r on an INSTALLED service */
    stdin.write("r");
    await flush();

    /* @Then it is refused with a hint, and no confirm opens */
    const frame = lastFrame() ?? "";
    assertStringIncludes(frame, "Uninstall");
    assert(!frame.includes("remove service"), "confirm must not open for an installed service");
    unmount();
  });
});
