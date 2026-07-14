import { assertEquals, assertRejects } from "@std/assert";
import { it } from "@std/testing/bdd";
import { join } from "@std/path";
import { parseBlueprint } from "@server/blueprint/parser/yaml.ts";
import { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";

/** A FileSystem for the YAML-only cases that never read sibling files. */
const anyDir = new FileSystem("/tmp");

async function inTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await Deno.makeTempDir({ prefix: "bp-parser-" });
  try {
    return await fn(dir);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
}

it("parseBlueprint — standalone blueprint with one role", async () => {
  /* @Given a valid YAML for a standalone blueprint with 1 role */
  const yaml = `
name: docker
description: Container runtime
version: 1.0.0
compatibility:
  os: [ubuntu-22-04]
roles:
  - name: main
    instances: one
    install:
      - name: install
        description: Install Docker
        run: apt-get install docker
        verify:
          run: command -v docker
`;
  /* @When the parser runs */
  const bp = await parseBlueprint(yaml, anyDir);

  /* @Then it produces the correct domain Blueprint */
  assertEquals(bp.name.value, "docker");
  assertEquals(bp.compatibility.os.map(String), ["ubuntu-22-04"]);
  assertEquals(bp.placement, "exclusive");
  assertEquals(bp.isHosted, false);
  assertEquals(bp.roles.length, 1);
  assertEquals(bp.roles[0].name, "main");
  assertEquals(bp.roles[0].instances, "one");
  assertEquals(bp.roles[0].installSteps.length, 1);
  assertEquals(bp.roles[0].installSteps[0].id.value, "install");
});

it("parseBlueprint — hosted blueprint with host", async () => {
  /* @Given a YAML hosted blueprint declaring host */
  const yaml = `
name: argocd
description: GitOps
version: 1.0.0
compatibility:
  os: [ubuntu-22-04]
host:
  blueprint: k3s
  role: server
install:
  - name: install
    description: install argocd
    run: kubectl apply -f manifest.yaml
`;
  /* @When the parser runs */
  const bp = await parseBlueprint(yaml, anyDir);

  /* @Then it is hosted with the correct host */
  assertEquals(bp.isHosted, true);
  assertEquals(bp.host?.blueprint.value, "k3s");
  assertEquals(bp.host?.role, "server");
  assertEquals(bp.installSteps.length, 1);
  assertEquals(bp.roles.length, 0);
});

it("parseBlueprint — rejects blueprint without roles or host", async () => {
  /* @Given a YAML without roles and without host */
  const yaml = `
name: bad
description: bad
version: 1.0.0
compatibility:
  os: [ubuntu-22-04]
`;
  /* @Then the parser throws */
  await assertRejects(() => parseBlueprint(yaml, anyDir), Error, "must declare either 'roles'");
});

it("parseBlueprint — rejects step without run or script", async () => {
  /* @Given a step with neither run nor script */
  const yaml = `
name: bad
description: bad
version: 1.0.0
compatibility:
  os: [ubuntu-22-04]
roles:
  - name: main
    install:
      - name: install
        description: install
`;
  /* @Then the parser throws */
  await assertRejects(() => parseBlueprint(yaml, anyDir), Error, "declare 'run'");
});

it("parseBlueprint — rejects step with both run and script", async () => {
  /* @Given a step with both run and script declared */
  const yaml = `
name: bad
description: bad
version: 1.0.0
compatibility:
  os: [ubuntu-22-04]
roles:
  - name: main
    install:
      - name: install
        description: install
        run: echo hi
        script: scripts/install.sh
`;
  /* @Then the parser throws */
  await assertRejects(() => parseBlueprint(yaml, anyDir), Error, "mutually exclusive");
});

it("parseBlueprint — defaults: placement=exclusive, instances=one", async () => {
  const yaml = `
name: defaults
description: Blueprint with defaults
version: 1.0.0
compatibility:
  os: [ubuntu-22-04]
roles:
  - name: main
    install:
      - name: install
        description: install
        run: echo hi
`;
  const bp = await parseBlueprint(yaml, anyDir);
  assertEquals(bp.placement, "exclusive");
  assertEquals(bp.roles[0].instances, "one");
});

it("parseBlueprint — reads a sibling script: file", async () => {
  await inTempDir(async (dir) => {
    /* @Given a blueprint that references scripts/install.sh */
    await Deno.mkdir(join(dir, "scripts"));
    await Deno.writeTextFile(join(dir, "scripts", "install.sh"), "#!/bin/bash\necho 'hello'\n");
    const yaml = `
name: scripted
description: Uses sidecar script
version: 1.0.0
compatibility:
  os: [ubuntu-22-04]
roles:
  - name: main
    install:
      - name: install
        description: install
        script: scripts/install.sh
`;
    await Deno.writeTextFile(join(dir, "blueprint.yaml"), yaml);

    /* @When parsing the file */
    const bp = await parseBlueprint(
      await Deno.readTextFile(join(dir, "blueprint.yaml")),
      new FileSystem(dir),
    );

    /* @Then the blueprint was parsed (descriptor ready; runtime stays in the installer) */
    assertEquals(bp.name.value, "scripted");
    assertEquals(bp.roles[0].installSteps[0].id.value, "install");
  });
});

it("parseBlueprint — inlines ${file:...} placeholder", async () => {
  await inTempDir(async (dir) => {
    /* @Given a blueprint that references ${file:operator.yaml} inside a run */
    await Deno.writeTextFile(
      join(dir, "operator.yaml"),
      "kind: Installation\nmetadata:\n  name: foo",
    );
    const yaml = `
name: inlined
description: Inlines an asset
version: 1.0.0
compatibility:
  os: [ubuntu-22-04]
host:
  blueprint: k3s
  role: server
install:
  - name: install
    description: install
    run: |
      cat <<'EOF'
      \${file:operator.yaml}
      EOF
`;
    await Deno.writeTextFile(join(dir, "blueprint.yaml"), yaml);

    /* @When parsing the file */
    const bp = await parseBlueprint(
      await Deno.readTextFile(join(dir, "blueprint.yaml")),
      new FileSystem(dir),
    );

    /* @Then the parser does not fail; the file content was inlined before the step was compiled */
    assertEquals(bp.name.value, "inlined");
    assertEquals(bp.installSteps.length, 1);
  });
});

it("parseBlueprint — inputs are parsed with type and required", async () => {
  const yaml = `
name: with-inputs
description: blueprint with inputs
version: 1.0.0
compatibility:
  os: [ubuntu-22-04]
inputs:
  - name: api-key
    label: API key
    type: secret
    required: true
    help: Provided by user
  - name: port
    label: Port
    type: number
    default: 8080
roles:
  - name: main
    install:
      - name: install
        description: install
        run: echo hi
`;
  const bp = await parseBlueprint(yaml, anyDir);
  assertEquals(bp.inputs.length, 2);
  assertEquals(bp.inputs[0].name.value, "api-key");
  assertEquals(bp.inputs[0].required, true);
  assertEquals(bp.inputs[1].name.value, "port");
  assertEquals(bp.inputs[1].defaultValue, 8080);
});

it("parseBlueprint — standalone role parses optional uninstall steps (reverse-order teardown)", async () => {
  /* @Given a standalone blueprint whose role declares uninstall steps */
  const yaml = `
name: k3s
description: K3s
version: 1.0.0
compatibility:
  os: [ubuntu-22-04]
roles:
  - name: server
    instances: one
    install:
      - name: install
        description: install k3s
        run: curl -sfL https://get.k3s.io | sh -
    uninstall:
      - name: uninstall
        description: uninstall k3s server
        run: /usr/local/bin/k3s-uninstall.sh
        verify:
          run: "! systemctl is-active k3s"
`;
  /* @When the parser runs */
  const bp = await parseBlueprint(yaml, anyDir);

  /* @Then the role carries its uninstall steps */
  assertEquals(bp.roles[0].installSteps.length, 1);
  assertEquals(bp.roles[0].uninstallSteps.length, 1);
  assertEquals(bp.roles[0].uninstallSteps[0].id.value, "uninstall");
});

it("parseBlueprint — hosted blueprint parses top-level uninstall steps", async () => {
  /* @Given a hosted blueprint with top-level uninstall steps */
  const yaml = `
name: portainer
description: Portainer
version: 1.0.0
compatibility:
  os: [ubuntu-22-04]
host:
  blueprint: docker
  role: main
install:
  - name: install
    description: run portainer
    run: docker run -d --name portainer portainer/portainer-ce
uninstall:
  - name: down
    description: remove portainer
    run: docker rm -f portainer
`;
  /* @When the parser runs */
  const bp = await parseBlueprint(yaml, anyDir);

  /* @Then the top-level uninstall steps are parsed */
  assertEquals(bp.installSteps.length, 1);
  assertEquals(bp.uninstallSteps.length, 1);
  assertEquals(bp.uninstallSteps[0].id.value, "down");
});

it("parseBlueprint — uninstall is optional (absent → empty)", async () => {
  /* @Given a standalone blueprint without uninstall steps */
  const yaml = `
name: docker
description: Container runtime
version: 1.0.0
compatibility:
  os: [ubuntu-22-04]
roles:
  - name: main
    instances: one
    install:
      - name: install
        description: Install Docker
        run: apt-get install docker
`;
  /* @When the parser runs */
  const bp = await parseBlueprint(yaml, anyDir);

  /* @Then uninstall steps default to empty */
  assertEquals(bp.roles[0].uninstallSteps.length, 0);
  assertEquals(bp.uninstallSteps.length, 0);
});
