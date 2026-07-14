/// <reference types="@types/react" />
import { assertStringIncludes } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { render } from "ink-testing-library";
import { RegisterSizeForm } from "@ui/size/register-form.tsx";
import { type RpcClients, RpcClientsProvider } from "@ui/rpc-clients-provider.tsx";
import { SessionProvider } from "@ui/auth/session-provider.tsx";

/**
 * Regression — the size register form used to import the Provider
 * enum directly from the engine. After the JSON-RPC decoupling it must
 * fetch the provider catalog over the wire via `cluster.providers.list`.
 * We verify the dropdown shows what the stub returns; if the form ever
 * silently falls back to a hardcoded list, this fails.
 */

const clients = {
  cluster: {
    listProviders: () => Promise.resolve(["proxmox"]),
  },
} as unknown as RpcClients;
const session = { sessionId: crypto.randomUUID(), expiresAt: "2099-01-01T00:00:00.000Z" };

const flush = () => new Promise((r) => setTimeout(r, 40));

describe("RegisterSizeForm — provider options", () => {
  it("shows the provider list fetched from the engine", async () => {
    const { lastFrame, unmount } = render(
      <RpcClientsProvider clients={clients}>
        <SessionProvider session={session}>
          <RegisterSizeForm onBack={() => {}} onCreated={() => {}} />
        </SessionProvider>
      </RpcClientsProvider>,
    );

    /* @Given the form mounts and the wire round-trip resolves */
    await flush();
    await flush();

    /* @Then the dropdown surfaces the provider returned by the engine */
    const frame = lastFrame() ?? "";
    assertStringIncludes(frame, "proxmox");

    unmount();
  });
});
