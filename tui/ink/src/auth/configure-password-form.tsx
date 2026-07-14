/// <reference types="@types/react" />
import { useState } from "react";
import { Box, Text, useInput } from "ink";
import type { AuthSession } from "@jsonrpc-contracts-ts/auth.gen.ts";
import { useAuth } from "@ui/rpc-clients-provider.tsx";
import { HelpBar } from "@ui/shared/help-bar.tsx";
import { Form, type Intent, ScreenFrame, Spinner } from "@ui/shared/design-system/mod.ts";
import { DimText } from "@ui/shared/theme/mod.ts";

type Result =
  | { type: "error"; summary: string; detail?: string }
  | null;

function shortError(msg: string): string {
  const first = msg.split("\n")[0]?.trim() ?? msg;
  return first.length > 80 ? first.slice(0, 77) + "..." : first;
}

type Props = {
  onConfigured: (response: AuthSession) => void;
  onCancel: () => void;
};

export function ConfigurePasswordForm({ onConfigured, onCancel }: Props) {
  const authClient = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result>(null);

  useInput((_char, key) => {
    if (!result) return;
    if (key.return || key.escape) setResult(null);
  }, { isActive: result !== null });

  const handleSubmit = (values: Record<string, string>) => {
    if (values.password.length < 8) {
      setResult({ type: "error", summary: "password must be at least 8 characters" });
      return;
    }
    if (values.password !== values.confirm) {
      setResult({ type: "error", summary: "passwords do not match" });
      return;
    }
    setSubmitting(true);
    authClient.configure({ password: values.password })
      .then((session) => {
        setSubmitting(false);
        onConfigured(session);
      })
      .catch((err: Error) => {
        setSubmitting(false);
        setResult({ type: "error", summary: shortError(err.message), detail: err.message });
      });
  };

  const intent: Intent | undefined = result?.type === "error" ? "danger" : undefined;
  const topRight = result ? <Text color="red">✗ {result.summary}</Text> : undefined;
  const secondary = result?.type === "error" && result.detail && result.detail !== result.summary
    ? (
      <Box paddingX={1}>
        <DimText color="red">{result.detail}</DimText>
      </Box>
    )
    : undefined;

  const footer = result?.type === "error"
    ? <HelpBar>↵/esc edit again</HelpBar>
    : <HelpBar>↵ next esc back ctrl+x cancel</HelpBar>;

  return (
    <ScreenFrame
      breadcrumb={["configure password"]}
      intent={intent}
      topRight={topRight}
      secondary={secondary}
      footer={footer}
      showLogo
      boxLayout="top"
    >
      {submitting ? <Spinner label="configuring password..." /> : (
        <Form
          fields={[
            {
              type: "string",
              name: "password",
              label: "password",
              description: "minimum 8 characters",
              required: true,
              mask: "*",
            },
            {
              type: "string",
              name: "confirm",
              label: "confirm",
              required: true,
              mask: "*",
            },
          ]}
          onSubmit={handleSubmit}
          onCancel={onCancel}
          disabled={result !== null}
        />
      )}
    </ScreenFrame>
  );
}
