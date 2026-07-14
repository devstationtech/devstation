/// <reference types="@types/react" />
import { useEffect, useMemo, useRef, useState } from "react";
import { Box, Text, useInput } from "ink";
import { useCluster, useVault } from "@ui/rpc-clients-provider.tsx";
import { useSessionId } from "@ui/auth/session-provider.tsx";
import { HelpBar } from "@ui/shared/help-bar.tsx";
import {
  type Field,
  Form,
  type Intent,
  ScreenFrame,
  Spinner,
  type Values,
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

type VaultOption = { id: string; name: string };
type SecretOption = { id: string; name: string };

type Props = {
  mode: "create" | "edit";
  clusterId: string;
  clusterName: string;
  node?: {
    id: string;
    name: string;
    ip: string;
    vaultId: string;
    usernameSecretId: string;
    passwordSecretId: string;
  };
  onBack: () => void;
  onSaved: () => void;
};

const SLUG = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;
const sanitizeSlug = (v: string) => v.toLowerCase().replace(/[^a-z0-9-]/g, "");

import { currentHost, currentUser } from "@ui/cli/paths.ts";

export function NodeForm({ mode, clusterId, clusterName, node, onBack, onSaved }: Props) {
  const vault = useVault();
  const clusterApi = useCluster();
  const sessionId = useSessionId();
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result>(null);
  const [submittedName, setSubmittedName] = useState(node?.name ?? "");

  const [vaults, setVaults] = useState<VaultOption[]>([]);
  const [secrets, setSecrets] = useState<SecretOption[]>([]);

  const [values, setValues] = useState<Values>(() => ({
    name: node?.name ?? "",
    ip: node?.ip ?? "",
    vault: node?.vaultId ?? "",
    usernameSecret: node?.usernameSecretId ?? "",
    passwordSecret: node?.passwordSecretId ?? "",
  }));

  const valuesRef = useRef(values);
  useEffect(() => {
    valuesRef.current = values;
  }, [values]);

  useEffect(() => {
    vault.listVaults({ sessionId }).then((list) => {
      setVaults(list.map((v: { id: string; name: string }) => ({ id: v.id, name: v.name })));
    });
  }, []);

  useEffect(() => {
    if (!values.vault) {
      setSecrets([]);
      return;
    }
    vault.listSecrets({ sessionId, vaultId: values.vault }).then((list) => {
      setSecrets(list.map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })));
    });
  }, [values.vault]);

  useInput((_char, key) => {
    if (!result) return;
    if (key.return) {
      if (result.type === "success") onSaved();
      else setResult(null);
      return;
    }
    if (key.escape) setResult(null);
  }, { isActive: result !== null });

  const handleSubmit = (final: Values) => {
    setSubmittedName(final.name);
    setSubmitting(true);
    const promise = mode === "create"
      ? clusterApi.nodesRegister({
        sessionId,
        clusterId,
        name: final.name.trim(),
        ip: final.ip.trim(),
        vaultId: final.vault,
        usernameSecretId: final.usernameSecret,
        passwordSecretId: final.passwordSecret,
      })
      : clusterApi.nodesUpdate({
        sessionId,
        clusterId,
        nodeId: node!.id,
        name: final.name.trim(),
        ip: final.ip.trim(),
        vaultId: final.vault,
        usernameSecretId: final.usernameSecret,
        passwordSecretId: final.passwordSecret,
      });
    promise
      .then(async () => {
        // SSH bootstrap: install the local devstation public key in
        // the node's `authorized_keys` so every later image/provisioning
        // step can use key-based SSH (the engine's `SshCli` is
        // key-only by design). Without this, the very first image
        // refresh fails with "Permission denied (publickey,password)".
        //
        // Both register and update re-run this — `installKey` is
        // idempotent (alreadyPresent flag) so the cost on update is
        // a single connection, and it covers the case where the
        // operator edited the credentials.
        const targetName = final.name.trim();
        let bootstrapWarning: string | undefined;
        try {
          const nodes = await clusterApi.nodesList({ sessionId, clusterId });
          const target = nodes.find((n) => n.name === targetName) ?? node;
          if (target?.id) {
            await clusterApi.bootstrapKey({ sessionId, clusterId, nodeId: target.id });
          }
        } catch (err) {
          // Don't fail the whole flow — node is registered, key just
          // didn't land. Surface the reason so the user can fix
          // credentials and retry from the cluster screen.
          bootstrapWarning = err instanceof Error ? err.message : String(err);
        }

        setSubmitting(false);
        const verb = mode === "create" ? "registered" : "updated";
        if (bootstrapWarning) {
          setResult({
            type: "error",
            summary: `Node '${targetName}' ${verb}, but SSH bootstrap failed.`,
            detail:
              `${bootstrapWarning}\n\nCheck the username/password in the vault and re-save the node to retry. ` +
              `Without a successful bootstrap, image refresh and provisioning will fail with "Permission denied (publickey,password)".`,
          });
        } else {
          setResult({ type: "success", summary: `Node '${targetName}' ${verb}` });
        }
      })
      .catch((err: Error) => {
        setSubmitting(false);
        setResult({ type: "error", summary: shortError(err.message), detail: err.message });
      });
  };

  const reloadVaults = async (): Promise<VaultOption[]> => {
    const list = await vault.listVaults({ sessionId });
    const opts = list.map((v) => ({ id: v.id, name: v.name }));
    setVaults(opts);
    return opts;
  };

  const reloadSecrets = async (vaultId: string): Promise<SecretOption[]> => {
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

  const createUsernameSecret = async (input?: string): Promise<string> => {
    if (!input || !input.trim()) throw new Error("username is required");
    const vaultId = valuesRef.current.vault;
    if (!vaultId) throw new Error("select vault first");
    const nodeName = valuesRef.current.name || node?.name || "node";
    const name = `${clusterName}-${nodeName}-usr`;
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
    if (!input || !input.trim()) throw new Error("password is required");
    const vaultId = valuesRef.current.vault;
    if (!vaultId) throw new Error("select vault first");
    const nodeName = valuesRef.current.name || node?.name || "node";
    const name = `${clusterName}-${nodeName}-pwd`;
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

  const fields = useMemo<Field[]>(() => [
    {
      type: "string",
      name: "name",
      label: "name",
      required: true,
      sanitize: sanitizeSlug,
      validate: (v) => SLUG.test(v) ? null : "must be a lowercase slug",
      initialValue: node?.name,
    },
    { type: "string", name: "ip", label: "ip", required: true, initialValue: node?.ip },
    {
      type: "select",
      name: "vault",
      label: "vault",
      required: true,
      options: vaults.map((v) => ({ label: v.name, value: v.id })),
      emptyMessage: "no vaults registered",
      initialValue: node?.vaultId,
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
      initialValue: node?.usernameSecretId,
      createOptions: [
        {
          label: "+ type new username",
          intent: "prompt",
          promptLabel: "Username",
          promptHint: () => `${clusterName}-${valuesRef.current.name || node?.name || "node"}-usr`,
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
      initialValue: node?.passwordSecretId,
      createOptions: [
        {
          label: "+ type new password",
          intent: "prompt",
          promptLabel: "Password",
          promptHint: () => `${clusterName}-${valuesRef.current.name || node?.name || "node"}-pwd`,
          promptMask: "*",
          handler: createPasswordSecret,
        },
      ],
    },
  ], [vaults, secrets, node, clusterName]);

  const subtitle = mode === "create" ? "register node" : `edit ${node?.name ?? "node"}`;
  const breadcrumb = ["topologies", clusterName, subtitle];

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
    : <HelpBar>↵ next esc back ctrl+x cancel</HelpBar>;

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
            label={`${mode === "create" ? "registering" : "updating"} node '${submittedName}'...`}
          />
        )
        : (
          <Form
            fields={fields}
            value={values}
            onChange={setValues}
            onSubmit={handleSubmit}
            onCancel={onBack}
            disabled={result !== null}
          />
        )}
    </ScreenFrame>
  );
}
