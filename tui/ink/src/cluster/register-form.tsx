/// <reference types="@types/react" />
import { useState } from "react";
import { Box, Text, useInput } from "ink";
import { useCluster } from "@ui/rpc-clients-provider.tsx";
import { useSessionId } from "@ui/auth/session-provider.tsx";
import { HelpBar } from "@ui/shared/help-bar.tsx";
import { Form, type Intent, ScreenFrame, Spinner } from "@ui/shared/design-system/mod.ts";
import { currentHost, currentUser } from "@ui/cli/paths.ts";
import { DimText } from "@ui/shared/theme/mod.ts";

type Props = {
  onBack: () => void;
  onCreated: (name: string) => void;
};

type Result =
  | { type: "success"; summary: string }
  | { type: "error"; summary: string; detail?: string }
  | null;

const SLUG = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;
const sanitizeSlug = (v: string) => v.toLowerCase().replace(/[^a-z0-9-]/g, "");

export function RegisterClusterForm({ onBack, onCreated }: Props) {
  const cluster = useCluster();
  const sessionId = useSessionId();
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result>(null);
  const [name, setName] = useState("");

  useInput((_char, key) => {
    if (!result) return;
    if (key.return) {
      if (result.type === "success") onCreated(name);
      else setResult(null);
      return;
    }
    if (key.escape) setResult(null);
  }, { isActive: result !== null });

  const handleSubmit = (values: Record<string, string>) => {
    setName(values.name);
    setSubmitting(true);
    cluster.register({
      sessionId,
      name: values.name,
      user: currentUser(),
      hostname: currentHost(),
    })
      .then(() => {
        setSubmitting(false);
        setResult({ type: "success", summary: `Cluster '${values.name}' registered` });
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
      breadcrumb={["topologies", "clusters", "register"]}
      intent={intent}
      topRight={topRight}
      secondary={secondary}
      footer={footer}
    >
      {submitting ? <Spinner label="registering cluster..." /> : result?.type === "success"
        // Registered: the success message (topRight) + footer say it all.
        // Keep the body empty — a lingering disabled `name:` field here
        // looked broken. Errors still show the form so it can be edited.
        ? null
        : (
          <Form
            fields={[
              {
                type: "string",
                name: "name",
                label: "name",
                required: true,
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

function shortError(msg: string): string {
  const first = msg.split("\n")[0]?.trim() ?? msg;
  return first.length > 80 ? first.slice(0, 77) + "..." : first;
}
