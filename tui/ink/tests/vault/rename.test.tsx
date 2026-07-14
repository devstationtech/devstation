/// <reference types="@types/react" />
import { assertStringIncludes } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { render } from "ink-testing-library";
import { VaultScreen } from "@ui/vault/index.tsx";
import { type RpcClients, RpcClientsProvider } from "@ui/rpc-clients-provider.tsx";
import { SessionProvider } from "@ui/auth/session-provider.tsx";

/**
 * Vault renaming is available in the TUI (not just via MCP): the list offers
 * `r rename`, and opening it pre-fills the current name and calls
 * `renameVault` in place (id preserved). Mirrors the rendered-screen test
 * pattern (RpcClientsProvider `clients` seam + ink-testing-library).
 */

function mockClients(renameVault: () => Promise<unknown>): RpcClients {
  return {
    vault: {
      listVaults: () => Promise.resolve([{ id: "v1", name: "homelab-core", version: 1 }]),
      renameVault,
    },
  } as unknown as RpcClients;
}

const session = { sessionId: crypto.randomUUID(), expiresAt: "2099-01-01T00:00:00.000Z" };
const flush = () => new Promise((r) => setTimeout(r, 40));

function setup(renameVault: () => Promise<unknown>) {
  return render(
    <RpcClientsProvider clients={mockClients(renameVault)}>
      <SessionProvider session={session}>
        <VaultScreen onBack={() => {}} />
      </SessionProvider>
    </RpcClientsProvider>,
  );
}

describe("VaultScreen — rename", () => {
  it("offers 'r rename' and opens a pre-filled rename form", async () => {
    /* @Given a vault list with one vault */
    const { stdin, lastFrame, unmount } = setup(() => Promise.resolve({}));
    await flush();

    /* @Then the help bar advertises rename */
    assertStringIncludes(lastFrame() ?? "", "r rename");

    /* @When the user presses r */
    stdin.write("r");
    await flush();

    /* @Then the rename form is shown, pre-filled with the current name */
    const frame = lastFrame() ?? "";
    assertStringIncludes(frame, "rename");
    assertStringIncludes(frame, "homelab-core");
    unmount();
  });
});
