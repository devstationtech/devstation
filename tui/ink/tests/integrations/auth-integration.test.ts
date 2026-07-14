import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Client } from "@jsonrpc-client-ts/client.ts";
import type { Channel } from "@jsonrpc-client-ts/channel.ts";
import type { Request } from "@jsonrpc-client-ts/envelope/request.ts";
import type { Response } from "@jsonrpc-client-ts/envelope/response/response.ts";
import { AuthIntegration } from "@ui/shared/integrations/auth-integration.ts";

/**
 * AuthIntegration is the SDK-style wrapper the UI uses to call
 * `auth.*` RPCs. Tiny by design — each method maps 1:1 to a wire
 * method. Tests pin the method names (renaming on the wire without
 * updating here would cause a UI-side typo to ship silently).
 */

class RecordingChannel implements Channel {
  last: Request | null = null;
  constructor(private readonly result: unknown) {}
  send(request: Request): Promise<Response> {
    this.last = request;
    return Promise.resolve({ jsonrpc: "2.0", id: request.id, result: this.result });
  }
  onNotification(): () => void {
    return () => {};
  }
}

function makeIntegration(result: unknown): { auth: AuthIntegration; channel: RecordingChannel } {
  const channel = new RecordingChannel(result);
  return { auth: new AuthIntegration(new Client(channel)), channel };
}

describe("AuthIntegration — wire method mapping", () => {
  it("configured() calls auth.configured", async () => {
    const { auth, channel } = makeIntegration({ configured: true });
    await auth.configured();
    assertEquals(channel.last?.method, "auth.configured");
  });

  it("configure() calls auth.configure and forwards the request body", async () => {
    /* @Given a request with a chosen password */
    const { auth, channel } = makeIntegration({});
    /* @When configure is invoked */
    await auth.configure({ password: "new-pw" });
    /* @Then the method + params are forwarded verbatim */
    assertEquals(channel.last?.method, "auth.configure");
    assertEquals(channel.last?.params, { password: "new-pw" });
  });

  it("resources() calls auth.resources (empty request by default)", async () => {
    const { auth, channel } = makeIntegration({});
    await auth.resources();
    assertEquals(channel.last?.method, "auth.resources");
    assertEquals(channel.last?.params, {});
  });

  it("authenticate() calls auth.authenticate and returns the session", async () => {
    /* @Given the server returns a session */
    const session = {
      sessionId: "sid-1",
      key: "k",
      expiresAt: "2026-01-01T00:00:00.000Z",
    };
    const { auth, channel } = makeIntegration(session);
    /* @When authenticate is invoked */
    const got = await auth.authenticate({ password: "pw" });
    /* @Then the wire method is auth.authenticate and the session round-trips */
    assertEquals(channel.last?.method, "auth.authenticate");
    assertEquals(got, session);
  });

  it("renew() calls auth.renew with the sessionId on the wire", async () => {
    /* @Given a renewed session response */
    const renewed = {
      sessionId: "sid-2",
      key: "k2",
      expiresAt: "2026-01-01T00:30:00.000Z",
    };
    const { auth, channel } = makeIntegration(renewed);
    /* @When renew is invoked with the current sessionId */
    const got = await auth.renew({ sessionId: "sid-1" });
    /* @Then the method + params reach the wire and the new session is returned */
    assertEquals(channel.last?.method, "auth.renew");
    assertEquals(channel.last?.params, { sessionId: "sid-1" });
    assertEquals(got, renewed);
  });
});
