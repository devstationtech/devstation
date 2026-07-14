import { assert } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { walk } from "@std/fs";
import { fromFileUrl } from "@std/path";

/**
 * @Given every source file under tui/ink/src/
 * @When  its code (comments stripped) is scanned for `Deno.` access
 * @Then  only the platform adapter `deno-runtime.ts` may touch `Deno.*`
 *
 * The UI must stay portable to Bun/Node: all host-runtime access flows
 * through the `Runtime` facade (`shared/platform/runtime.ts`), whose
 * sole Deno implementation is `deno-runtime.ts`. This is a content rule
 * — `Deno` is a global, not an import — so the import-graph arch tests
 * can't express it.
 */

const SRC = fromFileUrl(new URL("../../src/", import.meta.url));
const ADAPTER = "shared/platform/deno-runtime.ts";

function stripComments(code: string): string {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, "") // block comments
    .replace(/\/\/.*$/gm, ""); // line comments
}

describe("UI runtime isolation (portable to Bun/Node)", () => {
  it("only deno-runtime.ts touches Deno.* — everything else uses the facade", async () => {
    const offenders: string[] = [];

    for await (const entry of walk(SRC, { exts: [".ts", ".tsx"], includeDirs: false })) {
      const rel = entry.path.slice(SRC.length).replaceAll("\\", "/");
      if (rel === ADAPTER) continue;
      const code = stripComments(await Deno.readTextFile(entry.path));
      if (/\bDeno\./.test(code)) offenders.push(rel);
    }

    assert(
      offenders.length === 0,
      "These UI source files reach for Deno.* directly instead of the " +
        `platform runtime facade:\n  ${offenders.join("\n  ")}`,
    );
  });
});
