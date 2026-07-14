import { assertEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Tags } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/tags.ts";
import { InvalidTag } from "@server/cluster/domain/exceptions/invalid-tag.ts";

describe("Tags", () => {
  it("should accept a list of valid tags", () => {
    /* @Given valid free-form tags */
    const input = ["k3s", "db", "client-a"];

    /* @When the tags are built */
    const tags = new Tags(input);

    /* @Then the values should be preserved in order */
    assertEquals(tags.values, ["k3s", "db", "client-a"]);
  });

  it("should default to empty", () => {
    /* @Given no input */
    /* @When the tags are built with the default */
    const tags = new Tags();

    /* @Then the list should be empty */
    assertEquals(tags.values, []);
    assertEquals(Tags.empty().values, []);
  });

  it("should normalize trim, lowercase and drop empties", () => {
    /* @Given tags with whitespace, casing and blanks */
    const input = ["  K3s ", "DB", "", "   "];

    /* @When the tags are built */
    const tags = new Tags(input);

    /* @Then they should be normalized */
    assertEquals(tags.values, ["k3s", "db"]);
  });

  it("should dedup preserving first-seen order", () => {
    /* @Given duplicate tags after normalization */
    const input = ["media", "k3s", "Media", "media"];

    /* @When the tags are built */
    const tags = new Tags(input);

    /* @Then duplicates should be removed keeping order */
    assertEquals(tags.values, ["media", "k3s"]);
  });

  it("should accept alphanumeric with dot, hyphen and underscore", () => {
    /* @Given tags using the allowed punctuation */
    const tags = new Tags(["app.v2", "client-a", "node_1"]);

    /* @Then they should be accepted */
    assertEquals(tags.values, ["app.v2", "client-a", "node_1"]);
  });

  it("should reject a tag with invalid characters", () => {
    /* @Given a tag with a space inside */
    /* @When the tags are built */
    /* @Then InvalidTag should be thrown */
    assertThrows(() => new Tags(["bad tag"]), InvalidTag);
    assertThrows(() => new Tags(["client/a"]), InvalidTag);
    assertThrows(() => new Tags([".leading"]), InvalidTag);
  });

  it("should reject a tag longer than 50 chars", () => {
    /* @Given an overlong tag */
    const long = "a".repeat(51);

    /* @When the tags are built */
    /* @Then InvalidTag should be thrown */
    assertThrows(() => new Tags([long]), InvalidTag);
  });

  it("should expose has() against normalized input", () => {
    /* @Given a tags collection */
    const tags = new Tags(["k3s", "db"]);

    /* @Then has() should match regardless of casing/whitespace */
    assertEquals(tags.has(" K3S "), true);
    assertEquals(tags.has("media"), false);
  });

  it("should compare equality by ordered values", () => {
    /* @Given two collections with same tags */
    const a = new Tags(["k3s", "db"]);
    const b = new Tags(["K3s", " db "]);
    const c = new Tags(["db", "k3s"]);

    /* @Then equals should reflect order-sensitive equality */
    assertEquals(a.equals(b), true);
    assertEquals(a.equals(c), false);
  });
});
