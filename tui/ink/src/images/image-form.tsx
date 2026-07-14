/// <reference types="@types/react" />
import { useEffect, useState } from "react";
import { Box, Text, useInput } from "ink";
import { useCluster, useImage } from "@ui/rpc-clients-provider.tsx";
import { useSessionId } from "@ui/auth/session-provider.tsx";
import { currentHost, currentUser } from "@ui/cli/paths.ts";
import { HelpBar } from "@ui/shared/help-bar.tsx";
import { Form, type Intent, ScreenFrame, Spinner } from "@ui/shared/design-system/mod.ts";
import { DimText } from "@ui/shared/theme/mod.ts";

// The set of operating systems comes from the server (RPC
// `cluster.operatingSystems.list`); only the human-friendly label is a
// UI presentation concern, kept here as a cosmetic lookup. Unknown
// values fall back to the raw string so a new OS still renders.
const OS_LABELS: Record<string, string> = {
  "ubuntu-22-04": "Ubuntu 22.04 LTS",
  "ubuntu-24-04": "Ubuntu 24.04 LTS",
  "debian-12": "Debian 12 (Bookworm)",
  "debian-13": "Debian 13 (Trixie)",
};

type Option = { label: string; value: string };

type Result =
  | { type: "success"; summary: string }
  | { type: "error"; summary: string; detail?: string }
  | null;

const sanitizeName = (v: string) => v.toLowerCase().replace(/[^a-z0-9-]/g, "");

function shortError(msg: string): string {
  const first = msg.split("\n")[0]?.trim() ?? msg;
  return first.length > 80 ? first.slice(0, 77) + "..." : first;
}

type ImageData = {
  id: string;
  name: string;
  sourceUrl: string;
  os: string;
};

type Props = {
  mode: "create" | "edit";
  image?: ImageData;
  onBack: () => void;
  onSaved: () => void;
};

// The image catalog is a central context — registering/editing an image is not
// scoped to a cluster. Assigning it to a node stays a cluster concern.
export function ImageForm({ mode, image, onBack, onSaved }: Props) {
  const imageApi = useImage();
  const clusterApi = useCluster();
  const sessionId = useSessionId();
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result>(null);
  const [submittedName, setSubmittedName] = useState(image?.name ?? "");
  const [osOptions, setOsOptions] = useState<Option[] | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    clusterApi.listOperatingSystems({ sessionId })
      .then((values) => {
        if (cancelled) return;
        setOsOptions(values.map((v) => ({ value: v, label: OS_LABELS[v] ?? v })));
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setOptionsError(shortError(err.message));
        setOsOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [clusterApi, sessionId]);

  useInput((_char, key) => {
    if (!result) return;
    if (key.return) {
      if (result.type === "success") onSaved();
      else setResult(null);
      return;
    }
    if (key.escape) setResult(null);
  }, { isActive: result !== null });

  const handleSubmit = (values: Record<string, string>) => {
    setSubmittedName(values.name);
    setSubmitting(true);
    const os = values.os as "ubuntu-22-04" | "ubuntu-24-04" | "debian-12";
    const promise = mode === "create"
      ? imageApi.register({
        sessionId,
        name: values.name,
        os,
        sourceUrl: values.sourceUrl.trim(),
        user: currentUser(),
        hostname: currentHost(),
      })
      : imageApi.update({
        sessionId,
        id: image!.id,
        name: values.name,
        os,
        sourceUrl: values.sourceUrl.trim(),
      });
    promise
      .then(() => {
        setSubmitting(false);
        setResult({
          type: "success",
          summary: `Image '${values.name}' ${mode === "create" ? "registered" : "updated"}`,
        });
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
        <DimText color="red">could not load operating systems: {optionsError}</DimText>
      </Box>
    )
    : undefined;

  const footer = result?.type === "success"
    ? <HelpBar>↵ done esc edit again</HelpBar>
    : result?.type === "error"
    ? <HelpBar>↵/esc edit again</HelpBar>
    : <HelpBar>↵ next esc back ctrl+x cancel</HelpBar>;

  const subtitle = mode === "create" ? "register" : `edit ${image?.name ?? "image"}`;

  return (
    <ScreenFrame
      breadcrumb={["images", subtitle]}
      intent={intent}
      topRight={topRight}
      secondary={secondary}
      footer={footer}
    >
      <Box flexDirection="column" gap={1}>
        {submitting && (
          <Spinner
            label={`${mode === "create" ? "registering" : "updating"} image '${submittedName}'...`}
          />
        )}
        {osOptions === null ? <Spinner label="loading operating systems..." /> : (
          <Form
            fields={[
              {
                type: "string",
                name: "name",
                label: "name",
                required: true,
                sanitize: sanitizeName,
                initialValue: image?.name,
              },
              {
                type: "string",
                name: "sourceUrl",
                label: "image url",
                required: true,
                initialValue: image?.sourceUrl,
              },
              {
                type: "select",
                name: "os",
                label: "os",
                required: true,
                initialValue: image?.os ?? osOptions[0]?.value,
                options: osOptions,
              },
            ]}
            onSubmit={handleSubmit}
            onCancel={onBack}
            disabled={submitting || result !== null || osOptions.length === 0}
          />
        )}
      </Box>
    </ScreenFrame>
  );
}
