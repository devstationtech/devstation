import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { SecretRedactor } from "@server/station/outbound/installer/proxmox/runner/secret-redactor.ts";

describe("SecretRedactor", () => {
  it("cuts a declared publish prefix line at the prefix", () => {
    /* @Given a redactor knowing the TOKEN= publish prefix */
    const redactor = new SecretRedactor(["TOKEN="], () => []);

    /* @When a line publishes the secret */
    /* @Then the value after the prefix never survives */
    assertEquals(redactor.line("TOKEN=K10abc::server:xyz"), "TOKEN=[redacted]");
    assertEquals(redactor.line("  TOKEN=indented-too"), "  TOKEN=[redacted]");
  });

  it("scrubs known secret values wherever they appear", () => {
    /* @Given a redactor with a resolved secret value */
    const redactor = new SecretRedactor([], () => ["s3cr3t-value"]);

    /* @Then any echo of the value is replaced */
    assertEquals(
      redactor.line("connecting with password s3cr3t-value to db"),
      "connecting with password [redacted] to db",
    );
  });

  it("reads values live — a secret published mid-run redacts from then on", () => {
    /* @Given a live map the run mutates */
    const published = new Map<string, string>();
    const redactor = new SecretRedactor([], () => published.values());

    /* @When the value is unknown it passes; once published it is scrubbed */
    assertEquals(redactor.line("token is tk-12345678"), "token is tk-12345678");
    published.set("token", "tk-12345678");
    assertEquals(redactor.line("token is tk-12345678"), "token is [redacted]");
  });

  it("ignores values too short to be credentials", () => {
    /* @Given a tiny value that would shred unrelated text */
    const redactor = new SecretRedactor([], () => ["ok"]);

    /* @Then it is not redacted */
    assertEquals(redactor.line("everything ok here"), "everything ok here");
  });

  it("redacts multi-line blocks line by line", () => {
    /* @Given captured output containing a secret and a publish line */
    const redactor = new SecretRedactor(["TOKEN="], () => ["s3cr3t-value"]);

    /* @When a block is redacted */
    const out = redactor.text("line one s3cr3t-value\nTOKEN=abcdef\nclean line");

    /* @Then both rules applied per line */
    assertEquals(out, "line one [redacted]\nTOKEN=[redacted]\nclean line");
  });
});
