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
  onAuthenticated: (response: AuthSession) => void;
  onCancel: () => void;
  expired?: boolean;
};

export function AuthenticatePasswordForm({ onAuthenticated, onCancel, expired = false }: Props) {
  const authClient = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result>(null);

  useInput((_char, key) => {
    if (!result) return;
    if (key.return || key.escape) setResult(null);
  }, { isActive: result !== null });

  const handleSubmit = (values: Record<string, string>) => {
    if (!values.password) return;
    setSubmitting(true);
    authClient.authenticate({ password: values.password })
      .then((session) => {
        setSubmitting(false);
        onAuthenticated(session);
      })
      .catch((err: Error) => {
        setSubmitting(false);
        setResult({ type: "error", summary: shortError(err.message), detail: err.message });
      });
  };

  const intent: Intent | undefined = result?.type === "error" || expired ? "danger" : undefined;
  const topRight = result
    ? <Text color="red">✗ {result.summary}</Text>
    : expired
    ? <Text color="red">✗ session expired — please re-authenticate</Text>
    : undefined;
  const secondary = result?.type === "error" && result.detail && result.detail !== result.summary
    ? (
      <Box paddingX={1}>
        <DimText color="red">{result.detail}</DimText>
      </Box>
    )
    : undefined;

  const footer = result?.type === "error"
    ? <HelpBar>↵/esc retry</HelpBar>
    : <HelpBar>↵ authenticate esc back ctrl+x cancel</HelpBar>;

  return (
    <ScreenFrame
      breadcrumb={["authenticate"]}
      intent={intent}
      topRight={topRight}
      secondary={secondary}
      footer={footer}
      showLogo
      boxLayout="top"
    >
      {submitting ? <Spinner label="authenticating..." /> : (
        <Form
          fields={[
            {
              type: "string",
              name: "password",
              label: "password",
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
