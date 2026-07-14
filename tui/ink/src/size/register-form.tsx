/// <reference types="@types/react" />
import { useEffect, useState } from "react";
import { Box, Text, useInput } from "ink";
import { useCluster, useSize } from "@ui/rpc-clients-provider.tsx";
import { useSessionId } from "@ui/auth/session-provider.tsx";
import { HelpBar } from "@ui/shared/help-bar.tsx";
import { Form, type Intent, ScreenFrame, Spinner } from "@ui/shared/design-system/mod.ts";
import { currentHost, currentUser } from "@ui/cli/paths.ts";
import { DimText } from "@ui/shared/theme/mod.ts";

type Result =
  | { type: "success"; summary: string }
  | { type: "error"; summary: string; detail?: string }
  | null;

const SLUG = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;
const sanitizeSlug = (v: string) => v.toLowerCase().replace(/[^a-z0-9-]/g, "");
const sanitizeDigits = (v: string) => v.replace(/[^0-9]/g, "");

type Option = { label: string; value: string };

function shortError(msg: string): string {
  const first = msg.split("\n")[0]?.trim() ?? msg;
  return first.length > 80 ? first.slice(0, 77) + "..." : first;
}

type Props = {
  onBack: () => void;
  onCreated: (name: string) => void;
};

export function RegisterSizeForm({ onBack, onCreated }: Props) {
  const size = useSize();
  const clusterApi = useCluster();
  const sessionId = useSessionId();
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result>(null);
  const [name, setName] = useState("");
  // Provider list comes from the server via JSON-RPC, never inferred from
  // a UI-side enum import. Null until the round-trip lands.
  const [providerOptions, setProviderOptions] = useState<Option[] | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    clusterApi.listProviders({ sessionId })
      .then((providers) => {
        if (cancelled) return;
        setProviderOptions(providers.map((p) => ({ label: p, value: p })));
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setOptionsError(shortError(err.message));
        setProviderOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [clusterApi, sessionId]);

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
    size.register({
      sessionId,
      name: values.name,
      provider: values.provider,
      cpu: parseInt(values.cpu, 10),
      ram: parseInt(values.ram, 10),
      disk: parseInt(values.disk, 10),
      user: currentUser(),
      hostname: currentHost(),
    })
      .then(() => {
        setSubmitting(false);
        setResult({ type: "success", summary: `Size '${values.name}' registered` });
      })
      .catch((err: Error) => {
        setSubmitting(false);
        setResult({ type: "error", summary: shortError(err.message), detail: err.message });
      });
  };

  const intent: Intent | undefined = result?.type === "success"
    ? "success"
    : result?.type === "error" || optionsError
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
    : optionsError
    ? (
      <Box paddingX={1}>
        <DimText color="red">could not load providers: {optionsError}</DimText>
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
      breadcrumb={["topologies", "sizing", "register"]}
      intent={intent}
      topRight={topRight}
      secondary={secondary}
      footer={footer}
    >
      {submitting
        ? <Spinner label={`registering size '${name}'...`} />
        : providerOptions === null
        ? <Spinner label="loading providers..." />
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
              {
                type: "select",
                name: "provider",
                label: "provider",
                required: true,
                options: providerOptions,
                initialValue: providerOptions[0]?.value,
              },
              {
                type: "string",
                name: "cpu",
                label: "cpu cores",
                required: true,
                sanitize: sanitizeDigits,
                validate: (v) => parseInt(v, 10) > 0 ? null : "must be a positive integer",
              },
              {
                type: "string",
                name: "ram",
                label: "ram (mb)",
                required: true,
                sanitize: sanitizeDigits,
                validate: (v) => parseInt(v, 10) > 0 ? null : "must be a positive integer",
              },
              {
                type: "string",
                name: "disk",
                label: "disk (gb)",
                required: true,
                sanitize: sanitizeDigits,
                validate: (v) => parseInt(v, 10) > 0 ? null : "must be a positive integer",
              },
            ]}
            onSubmit={handleSubmit}
            onCancel={onBack}
            disabled={result !== null || providerOptions.length === 0}
          />
        )}
    </ScreenFrame>
  );
}
