import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { BinaryInstaller } from "@ui/self-update/installer/installer.ts";
import { PosixSwapStrategy } from "@ui/self-update/installer/posix-installer.ts";

/**
 * Drives the real download→verify→extract→swap flow with a stubbed
 * fetch and a real `tar` archive, against fake exec/home paths.
 * Skips on Windows (the POSIX swap strategy isn't the active one there).
 */

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

function stubFetch(bytes: Uint8Array): () => void {
  const original = globalThis.fetch;
  // deno-lint-ignore no-explicit-any
  globalThis.fetch =
    (() => Promise.resolve(new Response(new Blob([bytes as BlobPart]), { status: 200 }))) as any;
  return () => {
    globalThis.fetch = original;
  };
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Builds a tar.gz containing a single `devstation` file with `content`. */
async function makeArchive(home: string, content: string): Promise<Uint8Array> {
  const src = await Deno.makeTempDir();
  await Deno.writeTextFile(`${src}/devstation`, content);
  const archive = `${home}/src.tar.gz`;
  const out = await new Deno.Command("tar", {
    args: ["-czf", archive, "-C", src, "devstation"],
    stdout: "null",
    stderr: "null",
  }).output();
  if (!out.success) throw new Error("test setup: tar failed");
  const bytes = await Deno.readFile(archive);
  await Deno.remove(src, { recursive: true });
  await Deno.remove(archive);
  return bytes;
}

describe("BinaryInstaller (POSIX)", () => {
  it("downloads, verifies, swaps in place, and keeps .previous", async () => {
    if (Deno.build.os === "windows") return;
    /* @Given an existing binary and a stubbed fetch serving a matching-checksum archive */
    const home = await Deno.makeTempDir();
    const restore = withEnv({ DEVSTATION_HOME: home });
    try {
      const execPath = `${home}/devstation`;
      await Deno.writeTextFile(execPath, "OLD BINARY");
      await Deno.chmod(execPath, 0o755);

      const archiveBytes = await makeArchive(home, "NEW BINARY");
      const sha = await sha256Hex(archiveBytes);
      const unstub = stubFetch(archiveBytes);

      /* @When install runs the download→verify→extract→swap flow */
      const installer = new BinaryInstaller(new PosixSwapStrategy(execPath), "devstation");
      const outcome = await installer.install({
        asset: { url: "https://x/a.tar.gz", sha256: sha },
        version: "9.9.9",
      });

      /* @Then the new binary is in place and the old one kept as .previous */
      assertEquals(outcome.kind, "installed");
      assertEquals(await Deno.readTextFile(execPath), "NEW BINARY");
      assertEquals(await Deno.readTextFile(execPath + ".previous"), "OLD BINARY");
      unstub();
    } finally {
      restore();
      await Deno.remove(home, { recursive: true });
    }
  });

  it("rejects a checksum mismatch and leaves the binary untouched", async () => {
    if (Deno.build.os === "windows") return;
    /* @Given an archive served under a wrong (mismatched) sha256 */
    const home = await Deno.makeTempDir();
    const restore = withEnv({ DEVSTATION_HOME: home });
    try {
      const execPath = `${home}/devstation`;
      await Deno.writeTextFile(execPath, "OLD BINARY");

      const archiveBytes = await makeArchive(home, "NEW BINARY");
      const unstub = stubFetch(archiveBytes);

      /* @When install runs */
      const installer = new BinaryInstaller(new PosixSwapStrategy(execPath), "devstation");
      const outcome = await installer.install({
        asset: { url: "https://x/a.tar.gz", sha256: "deadbeef" },
        version: "9.9.9",
      });

      /* @Then it fails the checksum and leaves the binary untouched */
      assertEquals(outcome.kind, "failed");
      assertEquals(await Deno.readTextFile(execPath), "OLD BINARY");
      unstub();
    } finally {
      restore();
      await Deno.remove(home, { recursive: true });
    }
  });

  it("rollback restores the previous binary", async () => {
    if (Deno.build.os === "windows") return;
    /* @Given a current binary with a staged .previous */
    const home = await Deno.makeTempDir();
    const restore = withEnv({ DEVSTATION_HOME: home });
    try {
      const execPath = `${home}/devstation`;
      await Deno.writeTextFile(execPath, "NEW BINARY");
      await Deno.writeTextFile(execPath + ".previous", "OLD BINARY");

      /* @When rollback runs */
      const installer = new BinaryInstaller(new PosixSwapStrategy(execPath), "devstation");
      const outcome = await installer.rollback();

      /* @Then the previous binary is restored */
      assertEquals(outcome.kind, "rolled-back");
      assertEquals(await Deno.readTextFile(execPath), "OLD BINARY");
      restore();
    } finally {
      restore();
      await Deno.remove(home, { recursive: true });
    }
  });

  it("rollback with nothing staged reports nothing", async () => {
    if (Deno.build.os === "windows") return;
    const home = await Deno.makeTempDir();
    try {
      /* @Given a binary with no staged .previous */
      const execPath = `${home}/devstation`;
      await Deno.writeTextFile(execPath, "ONLY BINARY");
      /* @When rollback runs */
      const installer = new BinaryInstaller(new PosixSwapStrategy(execPath), "devstation");
      const outcome = await installer.rollback();
      /* @Then it reports nothing to roll back */
      assertEquals(outcome.kind, "nothing");
    } finally {
      await Deno.remove(home, { recursive: true });
    }
  });
});
