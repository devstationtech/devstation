/// <reference types="@types/react" />
import { assertEquals, assertMatch, assertStringIncludes } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { render } from "ink-testing-library";
import { VaultDetailScreen } from "@ui/vault/detail.tsx";
import { type RpcClients, RpcClientsProvider } from "@ui/rpc-clients-provider.tsx";
import { SessionProvider } from "@ui/auth/session-provider.tsx";

/**
 * A vault with a few dozen secrets must stay legible: the list
 * scrolls inside a windowed viewport that follows the selection, and long
 * names/descriptions truncate with an ellipsis instead of blowing up the row
 * layout. Mirrors the rendered-screen test pattern (RpcClientsProvider
 * `clients` seam + ink-testing-library).
 */

const vault = { id: "v1", name: "team-tools", version: 1 };

function secretsFixture(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `s${i + 1}`,
    name: i === 0
      ? "an-extremely-long-secret-name-that-used-to-overflow-the-row"
      : `secret-${i + 1}`,
    description: i === 0 ? "a description long enough to push every other column off screen" : null,
    createdBy: "andre",
    createdAt: "2026-08-15T00:00:00.000Z",
  }));
}

function mockClients(count: number): RpcClients {
  return {
    vault: {
      listSecrets: () => Promise.resolve(secretsFixture(count)),
    },
  } as unknown as RpcClients;
}

const session = { sessionId: crypto.randomUUID(), expiresAt: "2099-01-01T00:00:00.000Z" };
const flush = () => new Promise((r) => setTimeout(r, 40));
const tick = () => new Promise((r) => setTimeout(r, 5));
const DOWN = "[B";

function setup(count: number) {
  return render(
    <RpcClientsProvider clients={mockClients(count)}>
      <SessionProvider session={session}>
        <VaultDetailScreen vault={vault} onBack={() => {}} />
      </SessionProvider>
    </RpcClientsProvider>,
  );
}

describe("VaultDetailScreen — secret list legibility", () => {
  it("truncates long names and descriptions with an ellipsis", async () => {
    /* @Given a secret whose name and description exceed the column caps */
    const { lastFrame, unmount } = setup(3);
    await flush();

    /* @Then the cells are capped with … and never render in full */
    const frame = lastFrame() ?? "";
    assertStringIncludes(frame, "…");
    assertEquals(frame.includes("used-to-overflow-the-row"), false);
    assertEquals(frame.includes("off screen"), false);
    unmount();
  });

  it("windows a 21-secret list and reports the hidden tail", async () => {
    /* @Given a vault with 21 secrets (auto viewport: 30-row test terminal
       minus 16 reserved → 14 visible) */
    const { lastFrame, unmount } = setup(21);
    await flush();

    /* @Then only the first window renders, with the overflow counted */
    const frame = lastFrame() ?? "";
    assertStringIncludes(frame, "secret-14");
    assertEquals(frame.includes("secret-15"), false);
    assertStringIncludes(frame, "▼ 7 more");
    unmount();
  });

  it("expands the focused secret's full description below the table on i", async () => {
    /* @Given a focused secret whose description is truncated in the table */
    const { stdin, lastFrame, unmount } = setup(3);
    await flush();
    assertEquals((lastFrame() ?? "").includes("off screen"), false);

    /* @When the user presses i */
    stdin.write("i");
    await flush();

    /* @Then the full description and metadata expand below the table */
    const frame = lastFrame() ?? "";
    assertStringIncludes(frame.replace(/\s+/g, " "), "off screen");
    assertStringIncludes(frame, "created by andre");

    /* @When the user presses i again */
    stdin.write("i");
    await flush();

    /* @Then the info block collapses */
    assertEquals((lastFrame() ?? "").includes("off screen"), false);
    unmount();
  });

  it("keeps the selected secret visible while navigating down", async () => {
    /* @Given the cursor moved past the first window */
    const { stdin, lastFrame, unmount } = setup(21);
    await flush();
    for (let i = 0; i < 15; i++) {
      stdin.write(DOWN);
      await tick();
    }

    /* @Then the viewport followed the selection past the first window */
    const frame = lastFrame() ?? "";
    assertMatch(frame, /❯\s*secret-16/);
    assertStringIncludes(frame, "▲");
    unmount();
  });
});
