import { assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { ActiveInstalls } from "@server/station/application/services/active-installs.ts";
import { ServiceInstallInProgress } from "@server/station/domain/exceptions/service-install-in-progress.ts";
import { Id } from "@server/station/domain/models/service/id.ts";

describe("ActiveInstalls — in-process install concurrency guard", () => {
  it("rejects a second claim on the same service while the first is running", () => {
    /* @Given a service claimed by a running install */
    const installs = new ActiveInstalls();
    const serviceId = new Id();
    installs.claim(serviceId);

    /* @When a concurrent session claims it (MCP has no UI guard) */
    /* @Then the claim is rejected with an actionable error */
    assertThrows(
      () => installs.claim(serviceId),
      ServiceInstallInProgress,
      "already has a install",
    );
  });

  it("release frees the service for the next install (crash-free path)", () => {
    /* @Given a claim that was released */
    const installs = new ActiveInstalls();
    const serviceId = new Id();
    const release = installs.claim(serviceId);
    release();

    /* @Then the service can be claimed again */
    installs.claim(serviceId);
  });

  it("claimAll is all-or-nothing — a conflict rolls back every claim", () => {
    /* @Given service B already installing */
    const installs = new ActiveInstalls();
    const a = new Id();
    const b = new Id();
    installs.claim(b);

    /* @When a session claims [A, B] */
    assertThrows(() => installs.claimAll([a, b]), ServiceInstallInProgress);

    /* @Then A was NOT left claimed by the failed session */
    installs.claim(a);
  });
});
