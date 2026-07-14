import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { join } from "@std/path";
import { applyStagedUpdate } from "@ui/self-update/boot-applier.ts";
import { PENDING_MARKER } from "@ui/self-update/installer/windows-installer.ts";

function withEnv(vars: Record<string, string | undefined>): () => void {
  const prev: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(vars)) {
    prev[k] = Deno.env.get(k);
    if (v === undefined) Deno.env.delete(k);
    else Deno.env.set(k, v);
  }
  return () => {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) Deno.env.delete(k);
      else Deno.env.set(k, v);
    }
  };
}

describe("applyStagedUpdate", () => {
  it("returns null when there is no marker (the common case)", async () => {
    /* @Given a DEVSTATION_HOME with no pending marker */
    const home = await Deno.makeTempDir();
    const restore = withEnv({ DEVSTATION_HOME: home });
    try {
      /* @Then applyStagedUpdate is a no-op returning null */
      assertEquals(await applyStagedUpdate(), null);
    } finally {
      restore();
      await Deno.remove(home, { recursive: true });
    }
  });

  it("applies a valid staged update (current → previous, new → current)", async () => {
    const home = await Deno.makeTempDir();
    const restore = withEnv({ DEVSTATION_HOME: home });
    try {
      /* @Given a staged newer binary and a pending marker */
      const target = join(home, "devstation.exe");
      const newPath = target + ".new";
      const prevPath = target + ".previous";
      await Deno.writeTextFile(target, "OLD");
      await Deno.writeTextFile(newPath, "NEW");
      await Deno.writeTextFile(
        join(home, PENDING_MARKER),
        JSON.stringify({ version: "999.0.0", newPath, targetPath: target, previousPath: prevPath }),
      );

      /* @When the staged update is applied */
      const notice = await applyStagedUpdate();
      /* @Then current→previous, new→current, and the marker is consumed */
      assertEquals(typeof notice, "string");
      assertEquals(await Deno.readTextFile(target), "NEW");
      assertEquals(await Deno.readTextFile(prevPath), "OLD");
      // Marker consumed.
      assertEquals(await exists(join(home, PENDING_MARKER)), false);
    } finally {
      restore();
      await Deno.remove(home, { recursive: true });
    }
  });

  it("is idempotent — a stale marker (version <= current) is dropped, no swap", async () => {
    const home = await Deno.makeTempDir();
    const restore = withEnv({ DEVSTATION_HOME: home });
    try {
      /* @Given a stale marker whose version is <= the current binary */
      const target = join(home, "devstation.exe");
      const newPath = target + ".new";
      await Deno.writeTextFile(target, "CURRENT");
      await Deno.writeTextFile(newPath, "STALE");
      await Deno.writeTextFile(
        join(home, PENDING_MARKER),
        JSON.stringify({
          version: "0.0.1",
          newPath,
          targetPath: target,
          previousPath: target + ".previous",
        }),
      );

      /* @When the staged update is applied */
      const notice = await applyStagedUpdate();
      /* @Then no swap happens and the stale marker is dropped */
      assertEquals(notice, null);
      assertEquals(await Deno.readTextFile(target), "CURRENT");
      assertEquals(await exists(join(home, PENDING_MARKER)), false);
    } finally {
      restore();
      await Deno.remove(home, { recursive: true });
    }
  });

  it("swallows a corrupt marker and removes it", async () => {
    const home = await Deno.makeTempDir();
    const restore = withEnv({ DEVSTATION_HOME: home });
    try {
      /* @Given a corrupt (non-JSON) marker */
      await Deno.writeTextFile(join(home, PENDING_MARKER), "{ not valid json");
      /* @Then applyStagedUpdate swallows it and returns null */
      assertEquals(await applyStagedUpdate(), null);
    } finally {
      restore();
      await Deno.remove(home, { recursive: true });
    }
  });
});

async function exists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}
