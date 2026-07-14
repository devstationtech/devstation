/// <reference types="@types/react" />
import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Text } from "ink";
import { render } from "ink-testing-library";
import { ConfirmDeleteScreen } from "@ui/shared/confirm-delete-screen.tsx";

const flush = () => new Promise((r) => setTimeout(r, 30));

describe("ConfirmDeleteScreen — guarded (in-use) deletion", () => {
  it("shows the warning and deletes when the user types the confirm word", async () => {
    /* @Given a delete screen guarded by 'delete'/'remove' with an in-use warning */
    let deleted = false;
    const { stdin, lastFrame, unmount } = render(
      <ConfirmDeleteScreen
        title="unregister image"
        itemId="ubuntu-22"
        entityLabel="image"
        warning={<Text>in use by homelab / cp4</Text>}
        confirmWord="remove"
        onDelete={() => {
          deleted = true;
          return Promise.resolve();
        }}
        onConfirmed={() => {}}
        onBack={() => {}}
      />,
    );
    await flush();
    /* @Then the warning is visible */
    assertStringIncludes(lastFrame() ?? "", "in use by homelab / cp4");

    /* @When the user types an accepted word and confirms */
    stdin.write("remove");
    await flush();
    stdin.write("\r");
    await flush();

    /* @Then deletion runs */
    assert(deleted, "typing the confirm word should trigger onDelete");
    unmount();
  });

  it("ignores a non-matching word (typing the name does NOT delete when guarded)", async () => {
    /* @Given a guarded delete screen */
    let deleted = false;
    const { stdin, unmount } = render(
      <ConfirmDeleteScreen
        title="unregister image"
        itemId="ubuntu-22"
        entityLabel="image"
        confirmWord="remove"
        onDelete={() => {
          deleted = true;
          return Promise.resolve();
        }}
        onConfirmed={() => {}}
        onBack={() => {}}
      />,
    );
    await flush();
    /* @When the user types the item name (not an accepted word) */
    stdin.write("ubuntu-22");
    await flush();
    stdin.write("\r");
    await flush();
    /* @Then nothing is deleted */
    assertEquals(deleted, false);
    unmount();
  });
});
