/// <reference types="@types/react" />
import { useState } from "react";
import { Box, Text, useInput } from "ink";
import { useVault } from "@ui/rpc-clients-provider.tsx";
import { useSessionId } from "@ui/auth/session-provider.tsx";
import { HelpBar } from "@ui/shared/help-bar.tsx";
import { Form, type Intent, ScreenFrame, Spinner } from "@ui/shared/design-system/mod.ts";
import { DimText } from "@ui/shared/theme/mod.ts";

type Result =
  | { type: "success"; summary: string }
  | { type: "error"; summary: string; detail?: string }
  | null;

const SLUG = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;
const sanitizeSlug = (v: string) => v.toLowerCase().replace(/[^a-z0-9-]/g, "");

function shortError(msg: string): string {
  const first = msg.split("\n")[0]?.trim() ?? msg;
  return first.length > 80 ? first.slice(0, 77) + "..." : first;
}

type Props = {
  vaultId: string;
  vaultName: string;
  secretId: string;
  currentName: string;
  onBack: () => void;
  onRenamed: () => void;
};

/**
 * Renames a secret in place — the id is preserved, so services that reference
 * the secret keep working (unlike delete + regenerate, which mints a new id).
 */
export function RenameSecretForm(
  { vaultId, vaultName, secretId, currentName, onBack, onRenamed }: Props,
) {
  const vault = useVault();
  const sessionId = useSessionId();
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result>(null);
  const [name, setName] = useState(currentName);

  useInput((_char, key) => {
    if (!result) return;
    if (key.return) {
      if (result.type === "success") onRenamed();
      else setResult(null);
      return;
    }
    if (key.escape) setResult(null);
  }, { isActive: result !== null });

  const handleSubmit = (values: Record<string, string>) => {
    setName(values.name);
    setSubmitting(true);
    vault.renameSecret({ sessionId, vaultId, secretId, name: values.name })
      .then(() => {
        setSubmitting(false);
        setResult({ type: "success", summary: `Secret renamed to '${values.name}'` });
      })
      .catch((err: Error) => {
        setSubmitting(false);
        setResult({ type: "error", summary: shortError(err.message), detail: err.message });
      });
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
    : <HelpBar>↵ save esc back ctrl+x cancel</HelpBar>;

  return (
    <ScreenFrame
      breadcrumb={["topologies", "vaults", vaultName, currentName, "rename"]}
      intent={intent}
      topRight={topRight}
      secondary={secondary}
      footer={footer}
    >
      {submitting ? <Spinner label={`renaming to '${name}'...`} /> : (
        <Form
          fields={[
            {
              type: "string",
              name: "name",
              label: "name",
              required: true,
              initialValue: currentName,
              sanitize: sanitizeSlug,
              validate: (v) => SLUG.test(v) ? null : "must be a lowercase slug",
            },
          ]}
          onSubmit={handleSubmit}
          onCancel={onBack}
          disabled={result !== null}
        />
      )}
    </ScreenFrame>
  );
}
