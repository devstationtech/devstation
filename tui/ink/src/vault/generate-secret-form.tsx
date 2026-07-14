/// <reference types="@types/react" />
import { useState } from "react";
import { Box, Text, useInput } from "ink";
import { useVault } from "@ui/rpc-clients-provider.tsx";
import { useSessionId } from "@ui/auth/session-provider.tsx";
import { HelpBar } from "@ui/shared/help-bar.tsx";
import { Form, type Intent, ScreenFrame, Spinner } from "@ui/shared/design-system/mod.ts";
import { currentHost, currentUser } from "@ui/cli/paths.ts";
import { DimText } from "@ui/shared/theme/mod.ts";

type Result =
  | { type: "success"; summary: string }
  | { type: "error"; summary: string; detail?: string }
  | null;

function shortError(msg: string): string {
  const first = msg.split("\n")[0]?.trim() ?? msg;
  return first.length > 80 ? first.slice(0, 77) + "..." : first;
}

type Props = {
  vaultId: string;
  onBack: () => void;
  onCreated: () => void;
};

export function GenerateSecretForm({ vaultId, onBack, onCreated }: Props) {
  const vault = useVault();
  const sessionId = useSessionId();
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result>(null);
  const [name, setName] = useState("");

  useInput((_char, key) => {
    if (!result) return;
    if (key.return) {
      if (result.type === "success") onCreated();
      else setResult(null);
      return;
    }
    if (key.escape) setResult(null);
  }, { isActive: result !== null });

  const handleSubmit = (values: Record<string, string>) => {
    setName(values.name);
    setSubmitting(true);
    vault.generateSecret({
      sessionId,
      vaultId,
      name: values.name,
      hostname: currentHost(),
      user: currentUser(),
      value: values.value.trim() || null,
      description: values.description.trim() || null,
    })
      .then(() => {
        setSubmitting(false);
        setResult({ type: "success", summary: `Secret '${values.name}' generated` });
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
    : <HelpBar>↵ next esc back ctrl+x cancel</HelpBar>;

  return (
    <ScreenFrame
      breadcrumb={["topologies", "vaults", "generate secret"]}
      intent={intent}
      topRight={topRight}
      secondary={secondary}
      footer={footer}
    >
      {submitting ? <Spinner label={`generating secret '${name}'...`} /> : (
        <Form
          fields={[
            { type: "string", name: "name", label: "name", required: true },
            {
              type: "string",
              name: "value",
              label: "value",
              mask: "•",
              description: "leave empty to auto-generate",
            },
            { type: "string", name: "description", label: "description" },
          ]}
          onSubmit={handleSubmit}
          onCancel={onBack}
          disabled={result !== null}
        />
      )}
    </ScreenFrame>
  );
}
