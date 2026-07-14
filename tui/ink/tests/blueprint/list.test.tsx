/// <reference types="@types/react" />
import { assert, assertStringIncludes } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { render } from "ink-testing-library";
import { BlueprintScreen } from "@ui/blueprint/index.tsx";
import { type RpcClients, RpcClientsProvider } from "@ui/rpc-clients-provider.tsx";
import { SessionProvider } from "@ui/auth/session-provider.tsx";
import type { BlueprintRecord } from "@jsonrpc-contracts-ts/blueprint.gen.ts";

/**
 * Regression: the blueprint list rendered the full description (capped at 60)
 * plus a "supported os" column; on real catalogs the row overflowed the
 * terminal width and ink wrapped every entry onto a second line. The list now
 * truncates the description earlier and leaves the OS list to the detail
 * screen (↵).
 */

const LONG_DESCRIPTION =
  "Argo CD declarative GitOps continuous delivery for Kubernetes with a very long descriptive tail";

function blueprint(name: string): BlueprintRecord {
  return {
    id: name,
    name,
    description: LONG_DESCRIPTION,
    version: "1.0.0",
    origin: "official",
    compatibility: { os: ["ubuntu-22-04", "ubuntu-24-04", "debian-12"] },
    roles: [],
    inputs: [],
    host: { blueprint: "k3s", role: "server" },
  } as unknown as BlueprintRecord;
}

function mockClients(): RpcClients {
  return {
    blueprint: { list: () => Promise.resolve([blueprint("argocd")]) },
  } as unknown as RpcClients;
}

const session = { sessionId: crypto.randomUUID(), expiresAt: "2099-01-01T00:00:00.000Z" };

const flush = () => new Promise((r) => setTimeout(r, 40));

describe("BlueprintScreen — list stays one line per blueprint", () => {
  it("truncates the description and omits the supported-os column", async () => {
    /* @Given a catalog entry with a long description and several OSes */
    const { lastFrame, unmount } = render(
      <RpcClientsProvider clients={mockClients()}>
        <SessionProvider session={session}>
          <BlueprintScreen onBack={() => {}} />
        </SessionProvider>
      </RpcClientsProvider>,
    );
    await flush();
    const frame = lastFrame() ?? "";

    /* @Then the description is truncated with an ellipsis, not shown whole */
    assert(!frame.includes(LONG_DESCRIPTION), "full description must not render");
    assertStringIncludes(frame, "…");

    /* @And the OS list stays out of the table (it lives in the detail screen) */
    assert(!frame.includes("supported os"), "supported-os column must be gone");
    assert(!frame.includes("ubuntu-22-04"), "OS names must not render in the list");

    /* @And the row still carries the identity columns */
    assertStringIncludes(frame, "argocd");
    assertStringIncludes(frame, "official");
    assertStringIncludes(frame, "hosted → k3s.server");
    unmount();
  });
});
