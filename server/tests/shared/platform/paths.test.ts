import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { defaultDevstationHome, userHome } from "@server/shared/platform/paths.ts";

function fakeEnv(values: Record<string, string>): Pick<Deno.Env, "get"> {
  return { get: (k: string) => values[k] };
}

describe("userHome", () => {
  it("returns $HOME on linux", () => {
    /* @Given $HOME on linux */
    /* @Then userHome returns it */
    assertEquals(userHome(fakeEnv({ HOME: "/home/alice" }), "linux"), "/home/alice");
  });

  it("returns $HOME on darwin", () => {
    /* @Given $HOME on darwin */
    /* @Then userHome returns it */
    assertEquals(userHome(fakeEnv({ HOME: "/Users/alice" }), "darwin"), "/Users/alice");
  });

  it("returns $USERPROFILE on windows", () => {
    /* @Given $USERPROFILE on windows */
    /* @Then userHome returns it */
    assertEquals(
      userHome(fakeEnv({ USERPROFILE: "C:\\Users\\Alice" }), "windows"),
      "C:\\Users\\Alice",
    );
  });

  it("on windows, falls back to $HOME when $USERPROFILE is missing (Cygwin/MSYS)", () => {
    /* @Given windows with only $HOME set (Cygwin/MSYS) */
    /* @Then userHome falls back to $HOME */
    assertEquals(
      userHome(fakeEnv({ HOME: "/cygdrive/c/Users/Alice" }), "windows"),
      "/cygdrive/c/Users/Alice",
    );
  });

  it("returns '.' as last resort so tests with DEVSTATION_HOME override still work", () => {
    /* @Given no home env vars set */
    /* @Then userHome returns '.' as last resort */
    assertEquals(userHome(fakeEnv({}), "linux"), ".");
    assertEquals(userHome(fakeEnv({}), "windows"), ".");
  });
});

describe("defaultDevstationHome", () => {
  it("prod build resolves ~/devstation on linux", () => {
    /* @Given $HOME on linux and a compiled (non-deno) executable */
    /* @Then the default prod home is ~/devstation (no dot) */
    assertEquals(
      defaultDevstationHome(fakeEnv({ HOME: "/home/alice" }), "linux", false),
      "/home/alice/devstation",
    );
  });

  it("dev build resolves ~/devstation-dev on linux (isolated from prod)", () => {
    /* @Given the from-source `deno run` build */
    /* @Then the default dev home is ~/devstation-dev */
    assertEquals(
      defaultDevstationHome(fakeEnv({ HOME: "/home/alice" }), "linux", true),
      "/home/alice/devstation-dev",
    );
  });

  it("prod build resolves ~/devstation on darwin", () => {
    assertEquals(
      defaultDevstationHome(fakeEnv({ HOME: "/Users/alice" }), "darwin", false),
      "/Users/alice/devstation",
    );
  });

  it("returns %APPDATA%\\devstation on windows (prod) when APPDATA is set", () => {
    /* @Given windows with APPDATA set, prod build */
    const out = defaultDevstationHome(
      fakeEnv({
        APPDATA: "C:\\Users\\Alice\\AppData\\Roaming",
        USERPROFILE: "C:\\Users\\Alice",
      }),
      "windows",
      false,
    );
    /* @Then it lives under %APPDATA%\devstation */
    assertEquals(out.endsWith("devstation"), true);
    assertEquals(out.includes("Roaming"), true);
  });

  it("dev build appends -dev under %APPDATA% on windows", () => {
    const out = defaultDevstationHome(
      fakeEnv({ APPDATA: "C:\\Users\\Alice\\AppData\\Roaming" }),
      "windows",
      true,
    );
    assertEquals(out.endsWith("devstation-dev"), true);
  });

  it("falls back to %USERPROFILE%\\.devstation on windows when APPDATA is missing", () => {
    /* @Given windows with no APPDATA, only USERPROFILE, prod build */
    const out = defaultDevstationHome(
      fakeEnv({ USERPROFILE: "C:\\Users\\Alice" }),
      "windows",
      false,
    );
    /* @Then it falls back to %USERPROFILE%\.devstation */
    assertEquals(out.endsWith(".devstation"), true);
    assertEquals(out.includes("Alice"), true);
  });
});
