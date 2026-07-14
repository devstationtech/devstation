/// <reference types="@types/react" />
import { useEffect, useRef, useState } from "react";
import { Box, Text, useInput } from "ink";
import type { BlueprintRecord } from "@jsonrpc-contracts-ts/blueprint.gen.ts";
import type {
  ServiceHostRef,
  ServiceInstance,
  StationInstanceRecord as InstanceRecord,
  StationServiceRecord as ServiceRecord,
} from "@jsonrpc-contracts-ts/station.gen.ts";
import { useBlueprint, useStation, useVault } from "@ui/rpc-clients-provider.tsx";
import { useSessionId } from "@ui/auth/session-provider.tsx";
import { DimText } from "@ui/shared/theme/mod.ts";

type InputValue = string | number | boolean;
import { HelpBar } from "@ui/shared/help-bar.tsx";
import {
  type Field,
  type Intent,
  ScreenFrame,
  Spinner,
  Table,
  type Values,
  Wizard,
  type WizardSection,
} from "@ui/shared/design-system/mod.ts";

const MULTIPLE_SLOT_CAP = 20;

/**
 * For roles with `instances: "many"`: returns how many slot pickers to
 * render. Starts at 1, grows by 1 every time the operator fills the last
 * visible slot — so the form expands as needed up to a high safety cap.
 */
function visibleSlotCount(roleName: string, values: Values, cap: number): number {
  let lastFilled = -1;
  for (let i = 0; i < cap; i++) {
    if (values[`role_${roleName}_${i}`]) lastFilled = i;
  }
  return Math.min(lastFilled + 2, cap);
}
const SLUG = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;
const sanitizeSlug = (v: string) => v.toLowerCase().replace(/[^a-z0-9-]/g, "");
const sanitizeDigits = (v: string) => v.replace(/[^0-9-]/g, "");

type Result =
  | { type: "success"; summary: string }
  | { type: "error"; summary: string; detail?: string }
  | null;

type Props = {
  /** Station the new service will belong to. */
  stationId: string;
  onBack: () => void;
  onSaved: () => void;
};

function shortError(msg: string): string {
  const first = msg.split("\n")[0]?.trim() ?? msg;
  return first.length > 100 ? first.slice(0, 97) + "..." : first;
}

import { currentHost, currentUser } from "@ui/cli/paths.ts";

export function ServiceForm({ stationId, onBack, onSaved }: Props) {
  const vault = useVault();
  const blueprintApi = useBlueprint();
  const stationApi = useStation();
  const sessionId = useSessionId();
  const [stacks, setStacks] = useState<readonly BlueprintRecord[] | null>(null);
  const [stackCursor, setStackCursor] = useState(0);
  const [selectedStack, setSelectedStack] = useState<BlueprintRecord | null>(null);

  const [instances, setInstances] = useState<readonly InstanceRecord[]>([]);
  const [hostServices, setHostServices] = useState<readonly ServiceRecord[]>([]);
  const [vaults, setVaults] = useState<{ id: string; name: string }[]>([]);
  const [secrets, setSecrets] = useState<{ id: string; name: string }[]>([]);

  const [values, setValues] = useState<Values>({ name: "", vault: "" });
  const valuesRef = useRef<Values>(values);
  useEffect(() => {
    valuesRef.current = values;
  }, [values]);

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result>(null);

  // Load stacks + vaults on mount.
  useEffect(() => {
    blueprintApi.list({ sessionId }).then(setStacks);
    vault.listVaults({ sessionId }).then((list) =>
      setVaults(list.map((v) => ({ id: v.id, name: v.name })))
    );
  }, [blueprintApi, vault, sessionId]);

  // After stack picked, load either instances (standalone) or host services (hosted).
  useEffect(() => {
    if (!selectedStack) return;
    if (selectedStack.host) {
      stationApi.servicesByBlueprint({
        sessionId,
        blueprint: selectedStack.host.blueprint,
      }).then(setHostServices);
    } else {
      stationApi.instancesList({ sessionId }).then(setInstances);
    }
  }, [stationApi, sessionId, selectedStack?.id, selectedStack?.host]);

  // Reload vault secrets when vault changes.
  useEffect(() => {
    if (!values.vault) {
      setSecrets([]);
      return;
    }
    vault.listSecrets({ sessionId, vaultId: values.vault }).then((list) =>
      setSecrets(list.map((s) => ({ id: s.id, name: s.name })))
    );
  }, [values.vault]);

  const reloadVaults = async (): Promise<{ id: string; name: string }[]> => {
    const list = await vault.listVaults({ sessionId });
    const opts = list.map((v) => ({ id: v.id, name: v.name }));
    setVaults(opts);
    return opts;
  };

  const reloadSecrets = async (vaultId: string): Promise<{ id: string; name: string }[]> => {
    const list = await vault.listSecrets({ sessionId, vaultId: vaultId });
    const opts = list.map((s) => ({ id: s.id, name: s.name }));
    setSecrets(opts);
    return opts;
  };

  const suggestedVaultName = (stackName: string): string => {
    const slug = valuesRef.current.name?.trim();
    return slug ? `service-${slug}` : `service-${stackName}`;
  };

  const createVault = (stackName: string) => async (input?: string): Promise<string> => {
    const desired = (input?.trim()) || suggestedVaultName(stackName);
    const existing = vaults.find((v) => v.name === desired);
    if (existing) return existing.id;
    await vault.createVault({
      sessionId,
      name: desired,
      user: currentUser(),
      hostname: currentHost(),
    });
    const after = await reloadVaults();
    const created = after.find((v) => v.name === desired);
    if (!created) throw new Error("vault created but not found");
    return created.id;
  };

  const createInputSecret =
    (inputName: string, defaultName: () => string) => async (input?: string): Promise<string> => {
      const vaultId = valuesRef.current.vault;
      if (!vaultId) throw new Error("select vault first");
      const value = input && input.trim() ? input.trim() : null;
      if (!value) throw new Error(`${inputName} is required`);
      const name = defaultName();
      const list = await vault.listSecrets({ sessionId, vaultId: vaultId });
      const existing = list.find((s) => s.name === name);
      if (existing) return existing.id;
      await vault.generateSecret({
        sessionId,
        vaultId,
        name,
        hostname: currentHost(),
        user: currentUser(),
        value,
      });
      const after = await reloadSecrets(vaultId);
      const created = after.find((s) => s.name === name);
      if (!created) throw new Error("secret created but not found");
      return created.id;
    };

  // -- pick-stack phase --
  useInput((_char, key) => {
    if (selectedStack || submitting || result) return;
    if (key.escape) {
      onBack();
      return;
    }
    if (!stacks || stacks.length === 0) return;
    if (key.upArrow) setStackCursor((c) => Math.max(0, c - 1));
    if (key.downArrow) setStackCursor((c) => Math.min(stacks.length - 1, c + 1));
    if (key.return) setSelectedStack(stacks[stackCursor]);
  });

  // -- result phase --
  useInput((_char, key) => {
    if (!result) return;
    if (key.return) {
      if (result.type === "success") onSaved();
      else setResult(null);
    }
    if (key.escape) setResult(null);
  }, { isActive: result !== null });

  if (!stacks) {
    return (
      <ScreenFrame
        breadcrumb={["topologies", "services", "register"]}
        footer={<HelpBar>esc back</HelpBar>}
      >
        <Spinner label="loading stacks..." />
      </ScreenFrame>
    );
  }

  if (!selectedStack) {
    const rows = stacks.map((s) => ({
      name: s.name,
      kind: s.host ? `hosted → ${s.host.blueprint}.${s.host.role}` : "standalone",
      roles: s.host ? "—" : s.roles.map((r) => `${r.name} (${r.instances})`).join(", "),
      placement: s.placement,
    }));
    return (
      <ScreenFrame
        breadcrumb={["topologies", "services", "register", "pick stack"]}
        footer={<HelpBar>↵ pick ↑↓ move esc back</HelpBar>}
      >
        <Table
          rows={rows}
          columns={[{ key: "name" }, { key: "kind" }, { key: "roles" }, { key: "placement" }]}
          focusedIndex={stacks.length === 0 ? undefined : stackCursor}
          emptyMessage="No stacks available."
        />
      </ScreenFrame>
    );
  }

  // -- configure phase --
  const sections = buildSections({
    stack: selectedStack,
    vaults,
    secrets,
    instances,
    hostServices,
    values,
    valuesRef,
    createVault: createVault(selectedStack.name),
    suggestedVaultName: () => suggestedVaultName(selectedStack.name),
    createInputSecret,
  });

  const handleSubmit = async (final: Values) => {
    setSubmitting(true);
    try {
      const inputs: Record<string, InputValue> = {};
      const secretsMap: Record<string, string> = {};
      for (const input of selectedStack.inputs) {
        const key = `input_${input.name}`;
        const raw = final[key] ?? "";
        if (input.type === "secret") {
          if (raw) secretsMap[input.name] = raw;
        } else if (input.type === "boolean") {
          inputs[input.name] = raw === "true";
        } else if (input.type === "number") {
          inputs[input.name] = Number(raw);
        } else {
          inputs[input.name] = raw;
        }
      }

      let resolvedInstances: ServiceInstance[] | null = null;
      let host: ServiceHostRef = null;

      if (selectedStack.host) {
        host = { serviceId: final.hostServiceId, role: selectedStack.host.role };
      } else {
        resolvedInstances = [];
        for (const role of selectedStack.roles) {
          // Read every possible slot up to the cap; only filled ones contribute
          // an instance. The Wizard hides empty trailing slots, but the values
          // bag may carry data from previously visible ones if the operator
          // backed off a pick.
          const cap = role.instances === "many" ? MULTIPLE_SLOT_CAP : 1;
          for (let i = 0; i < cap; i++) {
            const id = final[`role_${role.name}_${i}`];
            if (!id) continue;
            const inst = instances.find((it) => it.id === id);
            if (!inst) continue;
            resolvedInstances.push({
              role: role.name,
              host: inst.host,
              credentialVaultId: inst.credentialVaultId,
              usernameSecretId: inst.usernameSecretId,
              passwordSecretId: inst.passwordSecretId,
            });
          }
        }
      }

      await stationApi.servicesRegister({
        sessionId,
        stationId,
        name: final.name,
        blueprint: selectedStack.name,
        vaultId: final.vault,
        inputs,
        secrets: secretsMap,
        user: currentUser(),
        hostname: currentHost(),
        instances: resolvedInstances,
        host,
      });
      setSubmitting(false);
      setResult({ type: "success", summary: `service '${final.name}' registered` });
    } catch (err) {
      setSubmitting(false);
      const message = (err as Error).message;
      setResult({ type: "error", summary: shortError(message), detail: message });
    }
  };

  const intent: Intent | undefined = result?.type === "success"
    ? "success"
    : result?.type === "error"
    ? "danger"
    : undefined;

  const topRight = result
    ? (
      <Text color={intent === "success" ? "green" : "red"}>
        {intent === "success" ? "✓" : "✗"} {result.summary}
      </Text>
    )
    : undefined;

  const secondary = result?.type === "error" && result.detail && result.detail !== result.summary
    ? (
      <Box paddingX={1}>
        <DimText color="red">{result.detail}</DimText>
      </Box>
    )
    : undefined;

  const footer = result?.type === "success"
    ? <HelpBar>↵ done esc edit again</HelpBar>
    : result?.type === "error"
    ? <HelpBar>↵/esc edit again</HelpBar>
    : <HelpBar>↵ next ←/→ tabs esc back ctrl+x cancel</HelpBar>;

  return (
    <ScreenFrame
      breadcrumb={["topologies", "services", "register", selectedStack.name]}
      intent={intent}
      topRight={topRight}
      secondary={secondary}
      footer={footer}
    >
      {submitting ? <Spinner label={`registering '${values.name}'...`} /> : (
        <Wizard
          sections={sections}
          value={values}
          onChange={setValues}
          onSubmit={handleSubmit}
          onCancel={() => setSelectedStack(null)}
          disabled={result !== null}
        />
      )}
    </ScreenFrame>
  );
}

type BuildArgs = {
  stack: BlueprintRecord;
  vaults: { id: string; name: string }[];
  secrets: { id: string; name: string }[];
  instances: readonly InstanceRecord[];
  hostServices: readonly ServiceRecord[];
  values: Values;
  valuesRef: { current: Values };
  createVault: (input?: string) => Promise<string>;
  suggestedVaultName: () => string;
  createInputSecret: (
    inputName: string,
    defaultName: () => string,
  ) => (input?: string) => Promise<string>;
};

function buildSections(args: BuildArgs): WizardSection[] {
  const { stack, vaults, secrets, instances, hostServices, valuesRef } = args;
  const out: WizardSection[] = [];

  out.push({
    id: "general",
    label: "general",
    fields: [
      {
        type: "string",
        name: "name",
        label: "name",
        required: true,
        sanitize: sanitizeSlug,
        validate: (v) => SLUG.test(v) ? null : "must be a lowercase slug",
      },
      {
        type: "select",
        name: "vault",
        label: "vault",
        description: "Blueprint-level secrets and per-instance credentials live in this vault.",
        required: true,
        options: vaults.map((v) => ({ label: v.name, value: v.id })),
        emptyMessage: "no vaults registered",
        createOptions: [
          {
            label: "+ create vault",
            intent: "prompt",
            promptLabel: "Vault name",
            promptInitialValue: () => args.suggestedVaultName(),
            handler: args.createVault,
          },
        ],
      },
    ],
  });

  if (stack.host) {
    out.push(buildHostSection(stack, hostServices));
  } else {
    for (const role of stack.roles) {
      out.push(buildRoleSection(stack, role, instances, args.values));
    }
  }

  if (stack.inputs.length > 0) {
    out.push(buildInputsSection(stack, secrets, valuesRef, args.createInputSecret));
  }

  out.push({ id: "review", label: "review" });
  return out;
}

function buildHostSection(
  stack: BlueprintRecord,
  hostServices: readonly ServiceRecord[],
): WizardSection {
  const matching = hostServices.filter((s) => s.status === "INSTALLED");
  return {
    id: "host",
    label: "host",
    fields: [
      {
        type: "select",
        name: "hostServiceId",
        label: `host (${stack.host!.blueprint}.${stack.host!.role})`,
        required: true,
        options: matching.map((s) => ({
          label: s.name,
          value: s.id,
          secondary: [
            `${s.instances.length} instance${s.instances.length === 1 ? "" : "s"}`,
            s.lastInstalledAt ? `installed ${s.lastInstalledAt.slice(0, 10)}` : "",
          ],
        })),
        emptyMessage: matching.length === 0
          ? `no INSTALLED services of blueprint '${
            stack.host!.blueprint
          }' — register and install one first`
          : undefined,
      },
    ],
  };
}

/** Instance ids already picked in any role/slot field except `exceptName`. */
export function instancesPickedElsewhere(values: Values, exceptName: string): Set<string> {
  const taken = new Set<string>();
  for (const [key, value] of Object.entries(values)) {
    if (key === exceptName) continue;
    if (!key.startsWith("role_")) continue;
    if (typeof value === "string" && value !== "") taken.add(value);
  }
  return taken;
}

export function buildRoleSection(
  stack: BlueprintRecord,
  role: BlueprintRecord["roles"][number],
  instances: readonly InstanceRecord[],
  values: Values,
): WizardSection {
  const supportedOs = new Set(stack.compatibility.os);
  const compatible = instances.filter((i) => i.os === "" || supportedOs.has(i.os));
  const slotCount = role.instances === "many"
    ? visibleSlotCount(role.name, values, MULTIPLE_SLOT_CAP)
    : 1;

  const toOption = (inst: InstanceRecord) => ({
    label: inst.name,
    value: inst.id,
    secondary: [
      inst.provider,
      `${inst.cluster.name}/${inst.node.name}`,
      inst.host,
      inst.busy ? `busy: ${inst.busyBy?.serviceName ?? "another service"}` : "",
    ].filter(Boolean) as string[],
  });

  const fields: Field[] = [];
  for (let i = 0; i < slotCount; i++) {
    const isFirst = i === 0;
    const name = `role_${role.name}_${i}`;
    // A VM may fill exactly one role/slot. Exclude instances already picked
    // in any other field, but keep this field's own current selection so
    // the Select can still render and swap it.
    const taken = instancesPickedElsewhere(values, name);
    const current = values[name];
    const available = compatible.filter((inst) => !taken.has(inst.id) || inst.id === current);
    const baseOptions = available.map(toOption);

    const slotLabel = role.instances === "many"
      ? `${role.name} instance #${i + 1}${isFirst ? "" : " (optional)"}`
      : `${role.name} instance`;
    const description = isFirst
      ? `Select the VM that will run the '${role.name}' role of ${stack.name}.`
      : `Pick another VM, or choose '— none —' to skip.`;
    // Optional slots get a "(none)" entry up top so the operator can clear a
    // previously-picked instance — without it, Select only allows swapping.
    const options = isFirst ? baseOptions : [{ label: "— none —", value: "" }, ...baseOptions];
    fields.push({
      type: "select",
      name,
      label: slotLabel,
      description,
      required: isFirst,
      options,
      emptyMessage: compatible.length === 0
        ? `no compatible VMs (need ${stack.compatibility.os.join(", ")})`
        : baseOptions.length === 0
        ? "all compatible VMs are already assigned to another role"
        : undefined,
    });
  }
  return { id: `role-${role.name}`, label: role.name, fields };
}

function buildInputsSection(
  stack: BlueprintRecord,
  secrets: { id: string; name: string }[],
  valuesRef: { current: Values },
  createInputSecret: BuildArgs["createInputSecret"],
): WizardSection {
  const fields: Field[] = stack.inputs.map((input) => {
    const fieldName = `input_${input.name}`;
    if (input.type === "secret") {
      const defaultName = () => `service-${valuesRef.current.name || stack.name}-${input.name}`;
      return {
        type: "select",
        name: fieldName,
        label: input.label,
        description: input.help,
        required: input.required,
        options: secrets.map((s) => ({ label: s.name, value: s.id })),
        emptyMessage: "no secrets in this vault",
        createOptions: [
          {
            label: `+ type new ${input.label.toLowerCase()}`,
            intent: "prompt",
            promptLabel: input.label,
            promptHint: defaultName,
            promptMask: "*",
            handler: createInputSecret(input.name, defaultName),
          },
        ],
      };
    }
    if (input.type === "boolean") {
      return {
        type: "boolean",
        name: fieldName,
        label: input.label,
        description: input.help,
        initialValue: input.value === true,
      };
    }
    if (input.type === "number") {
      return {
        type: "string",
        name: fieldName,
        label: input.label,
        description: input.help,
        required: input.required,
        sanitize: sanitizeDigits,
        validate: (v) => v === "" || !isNaN(Number(v)) ? null : "must be a number",
        initialValue: input.value !== undefined ? String(input.value) : undefined,
      };
    }
    return {
      type: "string",
      name: fieldName,
      label: input.label,
      description: input.help,
      required: input.required,
      initialValue: input.value !== undefined ? String(input.value) : undefined,
    };
  });
  return { id: "inputs", label: "inputs", fields };
}
