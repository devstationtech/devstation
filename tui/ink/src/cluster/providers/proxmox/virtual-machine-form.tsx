/// <reference types="@types/react" />
import { useEffect, useMemo, useRef, useState } from "react";
import { Box, Text, useInput } from "ink";
import type {
  ClusterImageRecord as ImageAssignmentRecord,
  ProxmoxStorageRecord,
} from "@jsonrpc-contracts-ts/cluster.gen.ts";
import type { ImageRecord } from "@jsonrpc-contracts-ts/image.gen.ts";
import type { SizeRecord } from "@jsonrpc-contracts-ts/size.gen.ts";
import { currentHost, currentUser } from "@ui/cli/paths.ts";
import { useCluster, useImage, useSize, useVault } from "@ui/rpc-clients-provider.tsx";
import { useSessionId } from "@ui/auth/session-provider.tsx";
import { HelpBar } from "@ui/shared/help-bar.tsx";
import {
  type Intent,
  ScreenFrame,
  Spinner,
  type Values,
  Wizard,
  type WizardSection,
} from "@ui/shared/design-system/mod.ts";
import { DimText } from "@ui/shared/theme/mod.ts";

type Result =
  | { type: "success"; summary: string }
  | { type: "error"; summary: string; detail?: string }
  | null;

function shortError(msg: string): string {
  const first = msg.split("\n")[0]?.trim() ?? msg;
  return first.length > 80 ? first.slice(0, 77) + "..." : first;
}

type VirtualMachineData = {
  id: number;
  name: string;
  tags: string[];
  size: string;
  image: string;
  ip: string;
  gateway: string;
  dns: string;
  storage: string;
  cpu: number;
  ram: number;
  disk: number;
  credentialVaultId: string;
  usernameSecretId: string;
  passwordSecretId: string;
};

type Props = {
  mode: "create" | "edit";
  clusterId: string;
  clusterName: string;
  nodeId: string;
  nodeName: string;
  virtualMachine?: VirtualMachineData;
  onBack: () => void;
  onSaved: () => void;
};

const SLUG = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;
const sanitizeSlug = (v: string) => v.toLowerCase().replace(/[^a-z0-9-]/g, "");
const sanitizeDigits = (v: string) => v.replace(/[^0-9]/g, "");
const sanitizeIp = (v: string) => v.replace(/[^0-9.]/g, "");

export function VirtualMachineForm(
  { mode, clusterId, clusterName, nodeId, nodeName, virtualMachine, onBack, onSaved }: Props,
) {
  const vault = useVault();
  const clusterApi = useCluster();
  const sizeApi = useSize();
  const imageApi = useImage();
  const sessionId = useSessionId();
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result>(null);
  const [submittedName, setSubmittedName] = useState(virtualMachine?.name ?? "");

  const [sizes, setSizes] = useState<readonly SizeRecord[]>([]);
  const [images, setImages] = useState<readonly ImageRecord[]>([]);
  const [assignments, setAssignments] = useState<readonly ImageAssignmentRecord[]>([]);
  const [tagSuggestions, setTagSuggestions] = useState<readonly string[]>([]);
  const [storages, setStorages] = useState<readonly ProxmoxStorageRecord[]>([]);
  const [vaults, setVaults] = useState<{ id: string; name: string }[]>([]);
  const [secrets, setSecrets] = useState<{ id: string; name: string }[]>([]);

  const valuesRef = useRef<Values>({});

  const [values, setValues] = useState<Values>(() => ({
    name: virtualMachine?.name ?? "",
    virtualMachineId: virtualMachine ? String(virtualMachine.id) : "",
    tags: (virtualMachine?.tags ?? []).join(", "),
    size: virtualMachine?.size ?? "",
    image: virtualMachine?.image ?? "",
    imageVirtualMachineId: "",
    imageStorage: "",
    ip: virtualMachine?.ip ?? "",
    gateway: virtualMachine?.gateway ?? "",
    dns: virtualMachine?.dns ?? "",
    storage: virtualMachine?.storage ?? "",
    cpu: virtualMachine ? String(virtualMachine.cpu) : "",
    ram: virtualMachine ? String(virtualMachine.ram) : "",
    disk: virtualMachine ? String(virtualMachine.disk) : "",
    vault: virtualMachine?.credentialVaultId ?? "",
    usernameSecret: virtualMachine?.usernameSecretId ?? "",
    passwordSecret: virtualMachine?.passwordSecretId ?? "",
  }));

  useEffect(() => {
    sizeApi.list({ sessionId }).then(setSizes);
    imageApi.list({ sessionId }).then(setImages).catch(() => {});
    clusterApi.imagesList({ sessionId, clusterId }).then((rows) =>
      setAssignments(rows.filter((a) => a.nodeId === nodeId))
    ).catch(() => {});
    clusterApi.vmTags({ sessionId }).then((r) => setTagSuggestions(r.tags.map((t) => t.tag))).catch(
      () => {},
    );
    clusterApi.storageByNode({ sessionId, clusterId, nodeId }).then((result) => {
      if (result && result.storages) setStorages(result.storages);
    }).catch(() => {});
    vault.listVaults({ sessionId }).then((list) => {
      setVaults(list.map((v: { id: string; name: string }) => ({ id: v.id, name: v.name })));
    });
  }, [
    sizeApi,
    clusterApi,
    imageApi,
    vault,
    sessionId,
    clusterId,
    nodeId,
  ]);

  useEffect(() => {
    if (!values.vault) {
      setSecrets([]);
      return;
    }
    vault.listSecrets({ sessionId, vaultId: values.vault }).then((list) => {
      setSecrets(list.map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })));
    });
  }, [values.vault]);

  useEffect(() => {
    valuesRef.current = values;
  }, [values]);

  useEffect(() => {
    if (!values.image || images.length === 0) return;
    if (values.imageVirtualMachineId && values.imageStorage) return;
    const assignment = assignments.find((a) => a.imageId === values.image);
    if (assignment) {
      setValues((prev) => ({
        ...prev,
        imageVirtualMachineId: prev.imageVirtualMachineId || String(assignment.virtualMachineId),
        imageStorage: prev.imageStorage || assignment.storage,
      }));
    }
  }, [assignments, values.image, values.imageVirtualMachineId, values.imageStorage, nodeId]);

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

  const createVault = async (): Promise<string> => {
    const name = clusterName;
    const existing = vaults.find((v) => v.name === name);
    if (existing) return existing.id;
    await vault.createVault({ sessionId, name, user: currentUser(), hostname: currentHost() });
    const after = await reloadVaults();
    const created = after.find((v) => v.name === name);
    if (!created) throw new Error("vault created but not found");
    return created.id;
  };

  const usernameSecretName = () => {
    const vmName = valuesRef.current.name || virtualMachine?.name || "vm";
    return `${clusterName}-${nodeName}-${vmName}-usr`;
  };

  const passwordSecretName = () => {
    const vmName = valuesRef.current.name || virtualMachine?.name || "vm";
    return `${clusterName}-${nodeName}-${vmName}-pwd`;
  };

  const createUsernameSecret = async (input?: string): Promise<string> => {
    if (!input || !input.trim()) throw new Error("username is required");
    const vaultId = valuesRef.current.vault;
    if (!vaultId) throw new Error("select vault first");
    const name = usernameSecretName();
    const list = await vault.listSecrets({ sessionId, vaultId: vaultId });
    const existing = list.find((s) => s.name === name);
    if (existing) return existing.id;
    await vault.generateSecret({
      sessionId,
      vaultId,
      name,
      hostname: currentHost(),
      user: currentUser(),
      value: input.trim(),
    });
    const after = await reloadSecrets(vaultId);
    const created = after.find((s) => s.name === name);
    if (!created) throw new Error("secret created but not found");
    return created.id;
  };

  const createPasswordSecret = async (input?: string): Promise<string> => {
    const vaultId = valuesRef.current.vault;
    if (!vaultId) throw new Error("select vault first");
    const name = passwordSecretName();
    const list = await vault.listSecrets({ sessionId, vaultId: vaultId });
    const existing = list.find((s) => s.name === name);
    if (existing) return existing.id;
    const value = input && input.trim() ? input.trim() : null;
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

  useInput((_char, key) => {
    if (!result) return;
    if (key.return) {
      if (result.type === "success") onSaved();
      else setResult(null);
      return;
    }
    if (key.escape) setResult(null);
  }, { isActive: result !== null });

  const handleSubmit = async (final: Values) => {
    setSubmittedName(final.name);
    setSubmitting(true);
    const vmIdNum = parseInt(final.virtualMachineId, 10);
    const templateVirtualMachineIdNum = parseInt(final.imageVirtualMachineId, 10);
    const cpuNum = parseInt(final.cpu, 10) || 1;
    const ramNum = parseInt(final.ram, 10) || 512;
    const diskNum = parseInt(final.disk, 10) || 10;
    const tags = final.tags
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    try {
      const tmpl = images.find((t) => t.id === final.image);
      const existingAssignment = assignments.find((a) => a.imageId === final.image);
      if (tmpl && !existingAssignment) {
        await clusterApi.imagesAssign({
          sessionId,
          clusterId,
          nodeId,
          imageId: final.image,
          virtualMachineId: templateVirtualMachineIdNum,
          storage: final.imageStorage.trim(),
          name: tmpl.name,
          os: tmpl.os,
          sourceUrl: tmpl.sourceUrl,
        });
      } else if (tmpl && existingAssignment) {
        const newStorage = final.imageStorage.trim();
        const changed = existingAssignment.virtualMachineId !== templateVirtualMachineIdNum ||
          existingAssignment.storage !== newStorage;
        if (changed) {
          await clusterApi.imagesUpdateAssigned({
            sessionId,
            clusterId,
            nodeId,
            imageId: final.image,
            virtualMachineId: templateVirtualMachineIdNum,
            storage: newStorage,
          });
        }
      }
      if (mode === "create") {
        await clusterApi.vmRegister({
          sessionId,
          clusterId,
          nodeId,
          name: final.name,
          id: vmIdNum,
          size: final.size,
          image: final.image,
          tags,
          ip: final.ip.trim(),
          gateway: final.gateway.trim(),
          dns: final.dns.trim(),
          storage: final.storage.trim(),
          cpu: cpuNum,
          ram: ramNum,
          disk: diskNum,
          credentialVaultId: final.vault,
          usernameSecretId: final.usernameSecret,
          passwordSecretId: final.passwordSecret,
        });
      } else {
        await clusterApi.vmUpdate({
          sessionId,
          clusterId,
          nodeId,
          id: virtualMachine!.id,
          name: final.name,
          size: final.size,
          image: final.image,
          tags,
          ip: final.ip.trim(),
          gateway: final.gateway.trim(),
          dns: final.dns.trim(),
          storage: final.storage.trim(),
          cpu: cpuNum,
          ram: ramNum,
          disk: diskNum,
          credentialVaultId: final.vault,
          usernameSecretId: final.usernameSecret,
          passwordSecretId: final.passwordSecret,
        });
      }
      setSubmitting(false);
      setResult({
        type: "success",
        summary: `VM '${final.name}' ${mode === "create" ? "registered" : "updated"}`,
      });
    } catch (err) {
      setSubmitting(false);
      const message = (err as Error).message;
      setResult({ type: "error", summary: shortError(message), detail: message });
    }
  };

  const handleChange = (next: Values) => {
    // Sync image-specific fields with the picked image's existing assignment (if any)
    if (next.image !== values.image) {
      const assignment = assignments.find((a) => a.imageId === next.image);
      next.imageVirtualMachineId = assignment ? String(assignment.virtualMachineId) : "";
      next.imageStorage = assignment ? assignment.storage : "";
    }
    // Auto-fill cpu/ram/disk from size
    if (next.size !== values.size) {
      const def = sizes.find((d) => d.id === next.size);
      if (def) {
        if (def.cpu) next.cpu = String(def.cpu);
        if (def.ram) next.ram = String(def.ram);
        if (def.disk) next.disk = String(def.disk);
      }
    }
    // Auto-fill gateway/dns from IP subnet
    if (next.ip !== values.ip) {
      const octets = next.ip.trim().split(".");
      if (octets.length === 4 && octets.every((o) => o)) {
        const subnet = octets.slice(0, 3).join(".");
        if (!next.gateway) next.gateway = `${subnet}.1`;
        if (!next.dns) next.dns = `${subnet}.1`;
      }
    }
    setValues(next);
  };

  const sections = useMemo<WizardSection[]>(() => [
    {
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
          type: "string",
          name: "virtualMachineId",
          label: "vm id",
          required: true,
          sanitize: sanitizeDigits,
          validate: (v) => parseInt(v, 10) > 0 ? null : "must be a positive integer",
        },
        {
          type: "string",
          name: "tags",
          label: "tags",
          required: false,
          placeholder: tagSuggestions.length > 0
            ? `comma-separated — e.g. ${tagSuggestions.slice(0, 5).join(", ")}`
            : "comma-separated — e.g. k3s, db, media",
          sanitize: (v) => v.toLowerCase().replace(/[^a-z0-9._,\- ]/g, ""),
        },
      ],
    },
    {
      id: "os",
      label: "os",
      fields: [
        {
          type: "select",
          name: "image",
          label: "image",
          required: true,
          options: images.map((t) => {
            const assignment = assignments.find((a) => a.imageId === t.id);
            const secondary = assignment
              ? [`vmid ${assignment.virtualMachineId}`, assignment.storage]
              : ["(not assigned — will configure)"];
            return { label: t.name, value: t.id, secondary };
          }),
          emptyMessage: "no images registered in cluster",
        },
        {
          type: "string",
          name: "imageVirtualMachineId",
          label: "image vm id",
          required: true,
          sanitize: sanitizeDigits,
          validate: (v) => parseInt(v, 10) > 0 ? null : "must be a positive integer",
        },
        {
          type: "select",
          name: "imageStorage",
          label: "image storage",
          required: true,
          options: storages.map((s) => ({ label: s.id, value: s.id, secondary: s.type })),
          emptyMessage: "no storage detected — type one below",
          createOptions: [
            {
              label: "+ type custom storage",
              intent: "prompt",
              promptLabel: "Storage",
              promptPlaceholder: "e.g. local-lvm",
              handler: (input) => Promise.resolve(input?.trim() ?? ""),
            },
          ],
        },
        {
          type: "select",
          name: "storage",
          label: "vm storage",
          required: true,
          options: storages.map((s) => ({ label: s.id, value: s.id, secondary: s.type })),
          emptyMessage: "no storage detected — type one below",
          createOptions: [
            {
              label: "+ type custom storage",
              intent: "prompt",
              promptLabel: "Storage",
              promptPlaceholder: "e.g. local-lvm",
              handler: (input) => Promise.resolve(input?.trim() ?? ""),
            },
          ],
        },
      ],
    },
    {
      id: "compute",
      label: "compute",
      fields: [
        {
          type: "select",
          name: "size",
          label: "size",
          required: true,
          options: sizes.map((d) => ({
            label: d.name,
            value: d.id,
            secondary: [
              d.cpu ? `${d.cpu}c` : "",
              d.ram ? `${d.ram}MB` : "",
              d.disk ? `${d.disk}GB` : "",
            ],
          })),
          emptyMessage: "no sizes registered",
        },
        {
          type: "string",
          name: "cpu",
          label: "cpu cores",
          required: true,
          sanitize: sanitizeDigits,
        },
        {
          type: "string",
          name: "ram",
          label: "ram (mb)",
          required: true,
          sanitize: sanitizeDigits,
        },
        {
          type: "string",
          name: "disk",
          label: "disk (gb)",
          required: true,
          sanitize: sanitizeDigits,
        },
      ],
    },
    {
      id: "network",
      label: "network",
      fields: [
        { type: "string", name: "ip", label: "ip", required: true, sanitize: sanitizeIp },
        { type: "string", name: "gateway", label: "gateway", required: true, sanitize: sanitizeIp },
        { type: "string", name: "dns", label: "dns", required: true, sanitize: sanitizeIp },
      ],
    },
    {
      id: "credentials",
      label: "credentials",
      fields: [
        {
          type: "select",
          name: "vault",
          label: "vault",
          required: true,
          options: vaults.map((v) => ({ label: v.name, value: v.id })),
          emptyMessage: "no vaults registered",
          createOptions: [
            {
              label: `+ use cluster vault (${clusterName})`,
              intent: "silent",
              handler: createVault,
            },
          ],
        },
        {
          type: "select",
          name: "usernameSecret",
          label: "username secret",
          required: true,
          options: secrets.map((s) => ({ label: s.name, value: s.id })),
          emptyMessage: "no secrets in this vault",
          createOptions: [
            {
              label: "+ type new username",
              intent: "prompt",
              promptLabel: "Username",
              promptHint: () => usernameSecretName(),
              promptPlaceholder: "ubuntu",
              handler: createUsernameSecret,
            },
          ],
        },
        {
          type: "select",
          name: "passwordSecret",
          label: "password secret",
          required: true,
          options: secrets.map((s) => ({ label: s.name, value: s.id })),
          emptyMessage: "no secrets in this vault",
          createOptions: [
            {
              label: "+ generate new password",
              intent: "silent",
              handler: createPasswordSecret,
            },
            {
              label: "+ type new password",
              intent: "prompt",
              promptLabel: "Password",
              promptHint: () => passwordSecretName(),
              promptMask: "*",
              handler: createPasswordSecret,
            },
          ],
        },
      ],
    },
    { id: "review", label: "review" },
  ], [sizes, images, assignments, tagSuggestions, storages, vaults, secrets]);

  const subtitle = mode === "create" ? "register vm" : `edit ${virtualMachine?.name ?? "vm"}`;
  const breadcrumb = ["topologies", clusterName, nodeName, subtitle];

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
      breadcrumb={breadcrumb}
      intent={intent}
      topRight={topRight}
      secondary={secondary}
      footer={footer}
    >
      {submitting
        ? (
          <Spinner
            label={`${mode === "create" ? "registering" : "updating"} VM '${submittedName}'...`}
          />
        )
        : (
          <Wizard
            sections={sections}
            value={values}
            onChange={handleChange}
            onSubmit={handleSubmit}
            onCancel={onBack}
            disabled={result !== null}
          />
        )}
    </ScreenFrame>
  );
}
