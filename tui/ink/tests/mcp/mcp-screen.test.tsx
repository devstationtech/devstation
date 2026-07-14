/// <reference types="@types/react" />
import { assertEquals, assertStringIncludes } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { render } from "ink-testing-library";
import { McpScreen } from "@ui/mcp/index.tsx";
import { type RpcClients, RpcClientsProvider } from "@ui/rpc-clients-provider.tsx";
import { SessionProvider } from "@ui/auth/session-provider.tsx";
import type { AuthTokenGenerateRequest, AuthTokenState } from "@jsonrpc-contracts-ts/auth.gen.ts";

/**
 * `/mcp` screen — covers the token lifecycle a TUI operator drives:
 * discovering there is no token, minting one through the
 * scope/expiry/password flow, seeing an existing token, and revoking it.
 */

type AuthMock = {
  currentToken: () => Promise<AuthTokenState>;
  authenticate: () => Promise<{ sessionId: string; expiresAt: string }>;
  generateToken: (r: AuthTokenGenerateRequest) => Promise<unknown>;
  revokeToken: () => Promise<{ revoked: boolean }>;
};

const session = { sessionId: crypto.randomUUID(), expiresAt: "2099-01-01T00:00:00.000Z" };

function setup(auth: Partial<AuthMock>) {
  return render(
    <RpcClientsProvider clients={{ auth } as unknown as RpcClients}>
      <SessionProvider session={session}>
        <McpScreen onBack={() => {}} />
      </SessionProvider>
    </RpcClientsProvider>,
  );
}

// Input handlers schedule React 18 state updates that are batched; yield a
// few ticks so the next captured frame reflects them.
const flush = () => new Promise((r) => setTimeout(r, 40));

describe("McpScreen", () => {
  it("offers to generate a token when none is configured", async () => {
    /* @Given the server reports no MCP token */
    const { lastFrame, unmount } = setup({
      currentToken: () => Promise.resolve({ present: false } as AuthTokenState),
    });

    /* @When the screen finishes loading */
    await flush();

    /* @Then the overview invites the operator to generate one */
    const frame = lastFrame() ?? "";
    assertStringIncludes(frame, "No MCP access token is configured");
    assertStringIncludes(frame, "g generate");

    unmount();
  });

  it("shows the scopes of an existing token", async () => {
    /* @Given a token granting two scopes is stored */
    const { lastFrame, unmount } = setup({
      currentToken: () =>
        Promise.resolve({
          present: true,
          id: "tok-1",
          purpose: "mcp",
          scopes: ["clusters:read", "stations:read"],
          createdAt: "2026-05-01T00:00:00.000Z",
          expiresAt: null,
        }),
    });

    /* @When the overview renders */
    await flush();

    /* @Then it lists the granted scopes and the never-expires state */
    const frame = lastFrame() ?? "";
    assertStringIncludes(frame, "scoped MCP token is configured");
    assertStringIncludes(frame, "clusters:read");
    assertStringIncludes(frame, "stations:read");
    assertStringIncludes(frame, "never");

    unmount();
  });

  it("mints a token through the scope, expiry and password flow", async () => {
    /* @Given no token, and a server that verifies the password and mints */
    let minted: AuthTokenGenerateRequest | null = null;
    const { stdin, lastFrame, unmount } = setup({
      currentToken: () => Promise.resolve({ present: false } as AuthTokenState),
      authenticate: () =>
        Promise.resolve({ sessionId: "fresh-session", expiresAt: "2099-01-01T00:00:00.000Z" }),
      generateToken: (r) => {
        minted = r;
        return Promise.resolve({
          id: "tok-new",
          purpose: "mcp",
          scopes: r.scopes,
          createdAt: "2026-05-21T00:00:00.000Z",
          expiresAt: null,
        });
      },
    });
    await flush();

    /* @When the operator opens the scope picker and selects the first scope */
    stdin.write("g");
    await flush();
    stdin.write(" "); // toggle clusters:read
    await flush();
    stdin.write("\r"); // continue to expiry
    await flush();

    /* @And leaves the expiry empty (never expires) */
    stdin.write("\r");
    await flush();

    /* @And confirms the master password */
    stdin.write("hunter2");
    await flush();
    stdin.write("\r");
    await flush();
    await flush();

    /* @Then the token is minted with the chosen scope and the success shows */
    assertEquals(minted !== null, true);
    assertEquals((minted as unknown as AuthTokenGenerateRequest).scopes, ["clusters:read"]);
    assertEquals((minted as unknown as AuthTokenGenerateRequest).ttlDays, null);
    assertStringIncludes(lastFrame() ?? "", "MCP token minted");

    unmount();
  });

  it("revokes the configured token after confirmation", async () => {
    /* @Given a token is configured and the server accepts a revoke */
    let revoked = false;
    const { stdin, lastFrame, unmount } = setup({
      currentToken: () =>
        Promise.resolve({
          present: true,
          id: "tok-1",
          purpose: "mcp",
          scopes: ["clusters:read"],
          createdAt: "2026-05-01T00:00:00.000Z",
          expiresAt: null,
        }),
      revokeToken: () => {
        revoked = true;
        return Promise.resolve({ revoked: true });
      },
    });
    await flush();

    /* @When the operator revokes and types the confirmation word */
    stdin.write("r");
    await flush();
    stdin.write("revoke");
    await flush();
    stdin.write("\r");
    await flush();
    await flush();

    /* @Then the token is revoked and the success message shows */
    assertEquals(revoked, true);
    assertStringIncludes(lastFrame() ?? "", "MCP token revoked");

    unmount();
  });
});
