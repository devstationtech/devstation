/// <reference types="@types/react" />
import { assert, assertStringIncludes } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { render } from "ink-testing-library";
import { ImagesScreen } from "@ui/images/index.tsx";
import { type RpcClients, RpcClientsProvider } from "@ui/rpc-clients-provider.tsx";
import { SessionProvider } from "@ui/auth/session-provider.tsx";

/**
 * The list table omits the (long) source URL so it doesn't wrap on small
 * terminals; pressing ↵ opens a detail view that shows every field including
 * the full URL and where the image is in use.
 */
const URL =
  "https://cloud.debian.org/images/cloud/trixie/latest/debian-13-genericcloud-amd64.qcow2";

const clients = {
  image: {
    list: () =>
      Promise.resolve([
        {
          id: "img-1",
          name: "debian-13",
          os: "debian-13",
          sourceUrl: URL,
          version: 1,
          usages: [{ clusterId: "c1", clusterName: "homelab", nodeId: "n1", nodeName: "cp4" }],
        },
      ]),
  },
} as unknown as RpcClients;
const session = { sessionId: crypto.randomUUID(), expiresAt: "2099-01-01T00:00:00.000Z" };
const flush = () => new Promise((r) => setTimeout(r, 40));

describe("ImagesScreen", () => {
  const HOST = "cloud.debian.org";
  it("hides the URL in the list and reveals it (plus usage) in the detail view on ↵", async () => {
    const { stdin, lastFrame, unmount } = render(
      <RpcClientsProvider clients={clients}>
        <SessionProvider session={session}>
          <ImagesScreen onBack={() => {}} />
        </SessionProvider>
      </RpcClientsProvider>,
    );
    await flush();

    /* @Then the list shows the image but NOT the full URL */
    const list = lastFrame() ?? "";
    assertStringIncludes(list, "debian-13");
    assert(!list.includes(HOST), "the list table must not render the source URL");

    /* @When the user opens the detail view */
    stdin.write("\r");
    await flush();

    /* @Then it shows the full URL and where the image is in use */
    const detail = lastFrame() ?? "";
    assertStringIncludes(detail, HOST);
    assertStringIncludes(detail, "homelab / cp4");
    unmount();
  });
});
