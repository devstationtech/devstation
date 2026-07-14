import { assert } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { walk } from "@std/fs";
import { fromFileUrl } from "@std/path";

/**
 * @Given every source file under server/src/
 * @When  its code (comments stripped) is scanned for `Deno.` access
 * @Then  only the sanctioned homes may touch the runtime API
 *
 * Mirror of the TUI's deno-isolation rule: domain, application and inbound
 * endpoint code must stay runtime-agnostic (swappable to Node/Bun), going
 * through ports/platform helpers instead. This is a content rule — `Deno`
 * is a global, not an import — so the import-graph arch tests can't
 * express it. The allowlist IS the architecture statement: runtime access
 * lives in outbound adapters, the shared platform helpers, the transport
 * servers and the composition roots, nowhere else.
 */

const SRC = fromFileUrl(new URL("../../src/", import.meta.url));

const SANCTIONED = [
  /(^|\/)outbound\//, // hexagonal adapter homes (any BC)
  /^shared\/platform\//, // per-OS helpers (paths, signals, identity, executables)
  /^shared\/inbound\/rpc\/server\.ts$/, // stdio transport entrypoint
  /^shared\/inbound\/mcp\/server\.ts$/, // stdio transport entrypoint
  /^env\.ts$/, // env-derived configuration root
  /^dependencies\.ts$/, // composition root (picks per-OS adapters)
  /^rpc\.ts$/, // process entrypoint
  /^mcp\.ts$/, // process entrypoint
];

function stripComments(code: string): string {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

describe("server runtime isolation (portable to Bun/Node)", () => {
  it("only sanctioned homes touch Deno.* — domain/application/inbound stay agnostic", async () => {
    const offenders: string[] = [];

    for await (const entry of walk(SRC, { exts: [".ts"], includeDirs: false })) {
      const rel = entry.path.slice(SRC.length).replaceAll("\\", "/");
      if (SANCTIONED.some((pattern) => pattern.test(rel))) continue;
      const code = stripComments(await Deno.readTextFile(entry.path));
      if (/\bDeno\./.test(code)) offenders.push(rel);
    }

    assert(
      offenders.length === 0,
      "These server source files reach for Deno.* outside the sanctioned " +
        `homes (outbound adapters / shared platform / transport servers / roots):\n  ${
          offenders.join("\n  ")
        }`,
    );
  });
});
