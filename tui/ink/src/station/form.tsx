/// <reference types="@types/react" />
import { useState } from "react";
import { Box, Text } from "ink";
import { useStation } from "@ui/rpc-clients-provider.tsx";
import { useSessionId } from "@ui/auth/session-provider.tsx";
import { HelpBar } from "@ui/shared/help-bar.tsx";
import {
  Form,
  type Intent,
  ScreenFrame,
  Spinner,
  type Values,
} from "@ui/shared/design-system/mod.ts";
import { currentHost, currentUser } from "@ui/cli/paths.ts";
import { DimText } from "@ui/shared/theme/mod.ts";

const SLUG = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;
const sanitizeSlug = (v: string) => v.toLowerCase().replace(/[^a-z0-9-]/g, "");

type Result =
  | { type: "success"; summary: string }
  | { type: "error"; summary: string; detail?: string }
  | null;

export type StationData = {
  id: string;
  name: string;
  description: string;
};

type Props =
  | { mode: "create"; onBack: () => void; onSaved: () => void }
  | { mode: "edit"; station: StationData; onBack: () => void; onSaved: () => void };

export function StationForm(props: Props) {
  const station = useStation();
  const sessionId = useSessionId();
  const isEdit = props.mode === "edit";
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result>(null);

  const handleSubmit = async (values: Values) => {
    setSubmitting(true);
    try {
      const name = values.name.trim();
      const description = values.description.trim();
      if (props.mode === "edit") {
        await station.update({
          sessionId,
          stationId: props.station.id,
          name,
          description,
        });
        setResult({ type: "success", summary: `station '${name}' updated` });
      } else {
        await station.register({
          sessionId,
          name,
          description,
          user: currentUser(),
          hostname: currentHost(),
        });
        setResult({ type: "success", summary: `station '${name}' registered` });
      }
      setSubmitting(false);
      props.onSaved();
    } catch (err) {
      setSubmitting(false);
      const message = (err as Error).message;
      setResult({
        type: "error",
        summary: message.length > 100 ? message.slice(0, 97) + "..." : message,
        detail: message,
      });
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

  const secondary = result?.type === "error" && result.detail
    ? (
      <Box paddingX={1}>
        <DimText color="red">{result.detail}</DimText>
      </Box>
    )
    : undefined;

  const breadcrumbAction = props.mode === "edit" ? `edit ${props.station.name}` : "register";

  return (
    <ScreenFrame
      breadcrumb={["topologies", "stations", breadcrumbAction]}
      intent={intent}
      topRight={topRight}
      secondary={secondary}
      footer={<HelpBar>↵ next esc back ctrl+x cancel</HelpBar>}
    >
      {submitting ? <Spinner label={isEdit ? "saving station..." : "creating station..."} /> : (
        <Form
          fields={[
            {
              type: "string",
              name: "name",
              label: "name",
              required: true,
              sanitize: sanitizeSlug,
              validate: (v) => SLUG.test(v) ? null : "must be a lowercase slug",
              initialValue: props.mode === "edit" ? props.station.name : undefined,
            },
            {
              type: "string",
              name: "description",
              label: "description",
              placeholder: "optional",
              initialValue: props.mode === "edit" ? props.station.description : undefined,
            },
          ]}
          onSubmit={handleSubmit}
          onCancel={props.onBack}
          disabled={result !== null}
        />
      )}
    </ScreenFrame>
  );
}
