/// <reference types="@types/react" />
import { assertEquals, assertStringIncludes } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { render } from "ink-testing-library";
import { RegisterClusterForm } from "@ui/cluster/register-form.tsx";
import { type RpcClients, RpcClientsProvider } from "@ui/rpc-clients-provider.tsx";
import { SessionProvider } from "@ui/auth/session-provider.tsx";

/**
 * Regression: after a cluster registers successfully, the success message
 * shows but the input form must NOT linger underneath it. The user saw a
 * dangling, empty `name:` field below "✓ Cluster 'homelab' registered" —
 * the form was only disabled, not unmounted, on success.
 */

function mockClients(register: () => Promise<unknown>): RpcClients {
  return {
    cluster: { register },
  } as unknown as RpcClients;
}

const session = { sessionId: crypto.randomUUID(), expiresAt: "2099-01-01T00:00:00.000Z" };

function setup(register: () => Promise<unknown>) {
  return render(
    <RpcClientsProvider clients={mockClients(register)}>
      <SessionProvider session={session}>
        <RegisterClusterForm onBack={() => {}} onCreated={() => {}} />
      </SessionProvider>
    </RpcClientsProvider>,
  );
}

// Input handlers schedule React 18 state updates that are batched; yield a
// few ticks so the next captured frame reflects them.
const flush = () => new Promise((r) => setTimeout(r, 40));

describe("RegisterClusterForm — success state", () => {
  it("hides the input form once the cluster is registered", async () => {
    /* @Given the register endpoint resolves successfully */
    const { stdin, lastFrame, unmount } = setup(() => Promise.resolve({}));

    /* @When the user types a valid slug and submits */
    await flush();
    stdin.write("homelab");
    await flush();
    stdin.write("\r");
    await flush();
    await flush();

    const frame = lastFrame() ?? "";

    /* @Then the success message is shown ... */
    assertStringIncludes(frame, "Cluster 'homelab' registered");

    /* @And the form's `name:` field is gone (not a dangling empty input) */
    assertEquals(
      frame.includes("name:"),
      false,
      `form still rendered after success — dangling field:\n${frame}`,
    );

    unmount();
  });
});
