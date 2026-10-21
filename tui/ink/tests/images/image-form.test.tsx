/// <reference types="@types/react" />
import { assertStringIncludes } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { render } from "ink-testing-library";
import { ImageForm } from "@ui/images/image-form.tsx";
import { type RpcClients, RpcClientsProvider } from "@ui/rpc-clients-provider.tsx";
import { SessionProvider } from "@ui/auth/session-provider.tsx";

/**
 * Regression: the OS list on the image-register screen was hardcoded to
 * Ubuntu 22.04 + Debian 12. Every supported OS must be offered with a friendly label (the OS
 * value feeds blueprint compatibility, so it lives in the OperatingSystem
 * VO and the form must surface it).
 *
 * The form now fetches the OS catalog over JSON-RPC
 * (`cluster.operatingSystems.list`); the stub returns the same values
 * the server emits today so the regression assertion still holds.
 */

const clients = {
  cluster: {
    listOperatingSystems: () =>
      Promise.resolve(["ubuntu-22-04", "ubuntu-24-04", "ubuntu-26-04", "debian-12", "debian-13"]),
  },
} as unknown as RpcClients;
const session = { sessionId: crypto.randomUUID(), expiresAt: "2099-01-01T00:00:00.000Z" };

const flush = () => new Promise((r) => setTimeout(r, 40));

describe("ImageForm — OS options", () => {
  it("offers human-readable labels for every supported operating system", async () => {
    /* @Given the image form loads the supported operating systems */
    const { stdin, lastFrame, unmount } = render(
      <RpcClientsProvider clients={clients}>
        <SessionProvider session={session}>
          <ImageForm
            mode="create"
            onBack={() => {}}
            onSaved={() => {}}
          />
        </SessionProvider>
      </RpcClientsProvider>,
    );

    /* @When the user fills name + url and reaches the os select */
    await flush();
    stdin.write("img");
    await flush();
    stdin.write("\r");
    await flush();
    stdin.write("http://example.com/noble.img");
    await flush();
    stdin.write("\r");
    await flush();
    await flush();

    /* @Then every supported version is selectable with its friendly label */
    const frame = lastFrame() ?? "";
    assertStringIncludes(frame, "Ubuntu 22.04 LTS");
    assertStringIncludes(frame, "Ubuntu 24.04 LTS");
    assertStringIncludes(frame, "Ubuntu 26.04 LTS");
    assertStringIncludes(frame, "Debian 12 (Bookworm)");
    assertStringIncludes(frame, "Debian 13 (Trixie)");

    unmount();
  });
});
