import { assertEquals } from "@std/assert";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { join } from "@std/path";
import { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import { TokenStoreAdapter } from "@server/auth/outbound/token-store-adapter.ts";
import { AccessToken } from "@server/auth/domain/models/access-token/access-token.ts";
import { Scope } from "@server/auth/domain/models/access-token/scope.ts";
import { WrappedKey } from "@server/auth/domain/models/access-token/wrapped-key.ts";

/**
 * `TokenStoreAdapter` — the file-system `TokenStore` over
 * `${DEVSTATION_HOME}/mcp/token.json`. Pins the save ⇄ load round-trip,
 * the absent/remove behaviour, and the owner-only file mode.
 */

describe("token store adapter", () => {
  let dir: string;
  let adapter: TokenStoreAdapter;

  beforeEach(() => {
    dir = Deno.makeTempDirSync({ prefix: "token-store-" });
    adapter = new TokenStoreAdapter(new FileSystem(dir));
  });

  afterEach(() => Deno.remove(dir, { recursive: true }));

  it("save then load round-trips every token field", async () => {
    /* @Given a token with two scopes and a 30-day expiry */
    const token = AccessToken.issue({
      purpose: "mcp",
      scopes: [new Scope("clusters:read"), new Scope("clusters:provision:apply")],
      wrappedKey: new WrappedKey("1122:aabb", "5566", "99ff"),
      ttlDays: 30,
    });
    /* @When saved and loaded back */
    await adapter.save(token);
    const loaded = await adapter.load();
    /* @Then every field survives the JSON round-trip */
    assertEquals(loaded?.id.value, token.id.value);
    assertEquals(loaded?.purpose, "mcp");
    assertEquals(loaded?.scopes.map((s) => s.value), [
      "clusters:read",
      "clusters:provision:apply",
    ]);
    assertEquals(loaded?.wrappedKey.wrapped, "1122:aabb");
    assertEquals(loaded?.wrappedKey.salt, "5566");
    assertEquals(loaded?.wrappedKey.secret, "99ff");
    assertEquals(loaded?.createdAt.toString(), token.createdAt.toString());
    assertEquals(loaded?.expiresAt?.toString(), token.expiresAt?.toString());
  });

  it("load returns null when no token file exists", async () => {
    assertEquals(await adapter.load(), null);
  });

  it("a never-expires token round-trips with expiresAt null", async () => {
    const token = AccessToken.issue({
      purpose: "mcp",
      scopes: [new Scope("clusters:read")],
      wrappedKey: new WrappedKey("aa:bb", "cc", "dd"),
    });
    await adapter.save(token);
    assertEquals((await adapter.load())?.expiresAt, null);
  });

  it("save replaces a previously stored token (one token at a time)", async () => {
    const first = AccessToken.issue({
      purpose: "mcp",
      scopes: [new Scope("clusters:read")],
      wrappedKey: new WrappedKey("aa:bb", "cc", "dd"),
    });
    const second = AccessToken.issue({
      purpose: "mcp",
      scopes: [new Scope("stations:write")],
      wrappedKey: new WrappedKey("ee:ff", "11", "22"),
    });
    await adapter.save(first);
    await adapter.save(second);
    assertEquals((await adapter.load())?.scopes.map((s) => s.value), ["stations:write"]);
  });

  it("remove deletes the token; load then yields null", async () => {
    await adapter.save(
      AccessToken.issue({
        purpose: "mcp",
        scopes: [new Scope("clusters:read")],
        wrappedKey: new WrappedKey("aa:bb", "cc", "dd"),
      }),
    );
    await adapter.remove();
    assertEquals(await adapter.load(), null);
  });

  it("remove is a no-op when no token file exists", async () => {
    await adapter.remove();
    assertEquals(await adapter.load(), null);
  });

  it("the token file is written owner-only (mode 0600)", async () => {
    /* @Given a saved token */
    await adapter.save(
      AccessToken.issue({
        purpose: "mcp",
        scopes: [new Scope("clusters:read")],
        wrappedKey: new WrappedKey("aa:bb", "cc", "dd"),
      }),
    );
    /* @Then mcp/token.json carries owner-only permissions */
    const mode = Deno.statSync(join(dir, "mcp", "token.json")).mode;
    assertEquals((mode ?? 0) & 0o777, 0o600);
  });
});
