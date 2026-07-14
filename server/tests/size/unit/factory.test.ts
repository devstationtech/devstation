import { assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { SizeFactory } from "@server/size/application/factories/size-factory.ts";
import type { RegisterSize } from "@server/size/application/commands/register-size.ts";

describe("SizeFactory", () => {
  it("should throw on unsupported provider", () => {
    /* @Given a command with an unsupported provider */
    const command = {
      name: "vmsm",
      provider: "vmware" as any,
      user: "alice",
      host: "devstation",
      cpu: 2,
      ram: 2048,
      disk: 20,
    } satisfies RegisterSize;

    /* @When the factory tries to build the size with that command */
    /* @Then an exception should be thrown */
    assertThrows(() => SizeFactory.build(command), Error, "unsupported provider");
  });
});
