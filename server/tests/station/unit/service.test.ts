import { assertEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Service } from "@server/station/domain/models/service/service.ts";
import { Name } from "@server/station/domain/models/service/name.ts";
import { BlueprintName } from "@server/station/domain/models/service/blueprint-name.ts";
import { Vault } from "@server/shared/building-blocks/domain/models/value-objects/vault.ts";
import { Secret } from "@server/shared/building-blocks/domain/models/value-objects/secret.ts";
import { Secrets } from "@server/station/domain/models/service/secrets.ts";
import { Inputs } from "@server/station/domain/models/service/inputs.ts";
import { Instance } from "@server/station/domain/models/service/instance.ts";
import { Credential } from "@server/shared/building-blocks/domain/models/value-objects/credential.ts";
import { Role } from "@server/station/domain/models/service/role.ts";
import { Host } from "@server/station/domain/models/service/host.ts";
import { Id } from "@server/station/domain/models/service/id.ts";
import { Installation } from "@server/station/domain/models/service/installation.ts";
import { InstallResult } from "@server/station/domain/models/service/install-result.ts";
import { Status } from "@server/station/domain/models/service/status.ts";
import { ServiceNotInstalling } from "@server/station/domain/exceptions/service-not-installing.ts";
import { ServiceNotUninstalling } from "@server/station/domain/exceptions/service-not-uninstalling.ts";
import { Hostname } from "@server/shared/building-blocks/domain/models/value-objects/hostname.ts";
import { User } from "@server/shared/building-blocks/domain/models/value-objects/user.ts";
import { Creation } from "@server/shared/building-blocks/domain/models/value-objects/creation.ts";
import { Instant } from "@server/shared/building-blocks/domain/models/value-objects/instant.ts";

const creation = () => Creation.now(new User("test-user"), new Hostname("test-host"));

function instance(role: string, host: string): Instance {
  return new Instance(
    new Role(role),
    host,
    new Credential(new Vault(), new Secret(), new Secret()),
  );
}

function makeStandalone(name = "docker-host"): Service {
  return new Service(
    new Id(),
    new Name(name),
    new BlueprintName("docker"),
    new Vault(),
    new Inputs({}),
    new Secrets({}),
    [instance("main", "10.0.0.1")],
    null,
    creation(),
  );
}

function makeHosted(name = "argocd-prod"): Service {
  return new Service(
    new Id(),
    new Name(name),
    new BlueprintName("argocd"),
    new Vault(),
    new Inputs({}),
    new Secrets({}),
    [],
    new Host(new Id(), "server"),
    creation(),
  );
}

function installation(role: string, host: string): Installation {
  return new Installation(
    new Role(role),
    host,
    new InstallResult({ version: "1.0.0" }, {}, {}),
    new Instant(),
  );
}

describe("Service entity — construction", () => {
  it("standalone defaults to REGISTERED status", () => {
    /* @Given a newly built standalone service */
    const s = makeStandalone();
    /* @Then default status and empty installations */
    assertEquals(s.status, Status.REGISTERED);
    assertEquals(s.installations.length, 0);
    assertEquals(s.isHosted, false);
  });

  it("hosted reports isHosted=true", () => {
    /* @Given a hosted service */
    const s = makeHosted();
    /* @Then it is hosted and instances are empty */
    assertEquals(s.isHosted, true);
    assertEquals(s.instances.length, 0);
  });

  it("rejects both instances and host", () => {
    /* @Given a service with both instances and host */
    /* @Then the constructor throws */
    assertThrows(
      () =>
        new Service(
          new Id(),
          new Name("dual"),
          new BlueprintName("docker"),
          new Vault(),
          new Inputs({}),
          new Secrets({}),
          [instance("main", "10.0.0.1")],
          new Host(new Id(), "main"),
          creation(),
        ),
      Error,
      "cannot have both",
    );
  });

  it("rejects neither instances nor host", () => {
    /* @Given a service without instances and without host */
    /* @Then the constructor throws */
    assertThrows(
      () =>
        new Service(
          new Id(),
          new Name("none"),
          new BlueprintName("docker"),
          new Vault(),
          new Inputs({}),
          new Secrets({}),
          [],
          null,
          creation(),
        ),
      Error,
      "must declare either",
    );
  });
});

describe("Service entity — transitions", () => {
  it("startInstall → INSTALLING", () => {
    /* @Given a REGISTERED service */
    const s = makeStandalone();
    /* @When startInstall */
    s.startInstall();
    /* @Then status is INSTALLING */
    assertEquals(s.status, Status.INSTALLING);
  });

  it("startInstall is idempotent — calling on INSTALLING is a no-op", () => {
    /* @Given a service in INSTALLING */
    const s = makeStandalone();
    s.startInstall();
    /* @When re-startInstall */
    s.startInstall();
    /* @Then status remains INSTALLING (without throwing) — recovery from a dead CLI without manual */
    assertEquals(s.status, Status.INSTALLING);
  });

  it("install → INSTALLED with installations", () => {
    /* @Given a service in INSTALLING */
    const s = makeStandalone();
    s.startInstall();
    /* @When installing with 2 installations */
    s.install([installation("main", "10.0.0.1"), installation("agent", "10.0.0.2")]);
    /* @Then INSTALLED, installations persisted */
    assertEquals(s.status, Status.INSTALLED);
    assertEquals(s.installations.length, 2);
  });

  it("fail → FAILED", () => {
    /* @Given service INSTALLING */
    const s = makeStandalone();
    s.startInstall();
    /* @When fail */
    s.fail("boom");
    /* @Then FAILED */
    assertEquals(s.status, Status.FAILED);
  });

  it("abort → ABORTED", () => {
    /* @Given service INSTALLING */
    const s = makeStandalone();
    s.startInstall();
    /* @When abort */
    s.abort();
    /* @Then ABORTED */
    assertEquals(s.status, Status.ABORTED);
  });

  it("install outside INSTALLING throws", () => {
    /* @Given service REGISTERED */
    const s = makeStandalone();
    /* @Then direct install throws */
    assertThrows(() => s.install([]), ServiceNotInstalling);
  });

  it("fail outside INSTALLING throws", () => {
    /* @Given service REGISTERED */
    const s = makeStandalone();
    /* @Then direct fail throws */
    assertThrows(() => s.fail("boom"), ServiceNotInstalling);
  });
});

describe("Service.failureReason", () => {
  it("fail stores the reason; it survives as state, not just as an event", () => {
    /* @Given a installing service */
    const s = makeStandalone();
    s.startInstall();

    /* @When the install fails */
    s.fail("step 'install' failed (exit 1)");

    /* @Then the reason is part of the service state */
    assertEquals(s.failureReason, "step 'install' failed (exit 1)");
  });

  it("a new install attempt clears the previous failure reason", () => {
    /* @Given a service that failed before */
    const s = makeStandalone();
    s.startInstall();
    s.fail("boom");

    /* @When a new install starts */
    s.startInstall();

    /* @Then the stale reason is gone */
    assertEquals(s.failureReason, null);
  });

  it("a successful install leaves no failure reason", () => {
    /* @Given a installing service */
    const s = makeStandalone();
    s.startInstall();

    /* @When it installs successfully */
    s.install([installation("main", "10.0.0.1")]);

    /* @Then there is nothing to diagnose */
    assertEquals(s.failureReason, null);
  });
});

describe("Service entity — teardown transitions", () => {
  function installed(): Service {
    const s = makeStandalone();
    s.startInstall();
    s.install([installation("main", "10.0.0.1")]);
    return s;
  }

  it("startUninstall → UNINSTALLING", () => {
    /* @Given a installed service */
    const s = installed();
    /* @When startUninstall */
    s.startUninstall();
    /* @Then status is UNINSTALLING */
    assertEquals(s.status, Status.UNINSTALLING);
  });

  it("uninstalled → UNINSTALLED and clears installations", () => {
    /* @Given a service being uninstalled */
    const s = installed();
    s.startUninstall();
    /* @When teardown succeeds */
    s.uninstalled();
    /* @Then it holds no live installation anymore */
    assertEquals(s.status, Status.UNINSTALLED);
    assertEquals(s.installations.length, 0);
    assertEquals(s.failureReason, null);
  });

  it("uninstallFailed → UNINSTALL_FAILED with reason", () => {
    /* @Given a service being uninstalled */
    const s = installed();
    s.startUninstall();
    /* @When teardown fails */
    s.uninstallFailed("k3s-uninstall exited 1");
    /* @Then the reason survives as state */
    assertEquals(s.status, Status.UNINSTALL_FAILED);
    assertEquals(s.failureReason, "k3s-uninstall exited 1");
  });

  it("uninstallAborted → UNINSTALL_FAILED", () => {
    /* @Given a service being uninstalled */
    const s = installed();
    s.startUninstall();
    /* @When the run is aborted */
    s.uninstallAborted();
    /* @Then it rests in a retryable failed state */
    assertEquals(s.status, Status.UNINSTALL_FAILED);
  });

  it("uninstalled outside UNINSTALLING throws", () => {
    /* @Given a INSTALLED service (not being uninstalled) */
    const s = installed();
    /* @Then a direct uninstalled() throws */
    assertThrows(() => s.uninstalled(), ServiceNotUninstalling);
  });

  it("a uninstalled service can be reinstalled", () => {
    /* @Given a torn-down service */
    const s = installed();
    s.startUninstall();
    s.uninstalled();
    /* @When it is reinstalled */
    s.startInstall();
    s.install([installation("main", "10.0.0.1")]);
    /* @Then it is INSTALLED again */
    assertEquals(s.status, Status.INSTALLED);
  });
});

describe("Service.isRemovable", () => {
  it("a never-installed (REGISTERED) service is removable", () => {
    assertEquals(makeStandalone().isRemovable, true);
  });

  it("a INSTALLED service is NOT removable (must be uninstalled first)", () => {
    const s = makeStandalone();
    s.startInstall();
    s.install([installation("main", "10.0.0.1")]);
    assertEquals(s.isRemovable, false);
  });

  it("a FAILED service is NOT removable", () => {
    const s = makeStandalone();
    s.startInstall();
    s.fail("boom");
    assertEquals(s.isRemovable, false);
  });

  it("a UNINSTALLED service is removable again", () => {
    const s = makeStandalone();
    s.startInstall();
    s.install([installation("main", "10.0.0.1")]);
    s.startUninstall();
    s.uninstalled();
    assertEquals(s.isRemovable, true);
  });
});
