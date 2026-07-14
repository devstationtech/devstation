/// <reference types="@types/react" />
import { useEffect, useState } from "react";
import { Box, Text, useInput } from "ink";
import type { ProxmoxStorageRecord } from "@jsonrpc-contracts-ts/cluster.gen.ts";
import type { ImageRecord } from "@jsonrpc-contracts-ts/image.gen.ts";
import { useCluster, useImage } from "@ui/rpc-clients-provider.tsx";
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

const sanitizeDigits = (v: string) => v.replace(/[^0-9]/g, "");

type EditData = {
  imageId: string;
  imageName: string;
  virtualMachineId: number;
  storage: string;
};

type Props = {
  mode: "create" | "edit";
  clusterId: string;
  clusterName: string;
  nodeId: string;
  nodeName: string;
  assignment?: EditData;
  onBack: () => void;
  onSaved: () => void;
};

export function NodeImageAssignmentForm(
  { mode, clusterId, clusterName, nodeId, nodeName, assignment, onBack, onSaved }: Props,
) {
  const clusterApi = useCluster();
  const imageApi = useImage();
  const sessionId = useSessionId();
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result>(null);
  // The central catalog (what can be assigned) and the ids already assigned to
  // THIS node (what to hide from the picker — one image per node for now).
  const [images, setImages] = useState<readonly ImageRecord[]>([]);
  const [assignedImageIds, setAssignedImageIds] = useState<ReadonlySet<string>>(new Set());
  const [storages, setStorages] = useState<readonly ProxmoxStorageRecord[]>([]);

  useEffect(() => {
    imageApi.list({ sessionId }).then(setImages).catch(() => {});
    clusterApi.imagesList({ sessionId, clusterId }).then((assignments) => {
      setAssignedImageIds(
        new Set(assignments.filter((a) => a.nodeId === nodeId).map((a) => a.imageId)),
      );
    }).catch(() => {});
    clusterApi.storageByNode({ sessionId, clusterId, nodeId }).then((res) => {
      if (res && res.storages) setStorages(res.storages);
    }).catch(() => {});
  }, [clusterApi, imageApi, sessionId, clusterId, nodeId]);

  useInput((_char, key) => {
    if (!result) return;
    if (key.return) {
      if (result.type === "success") onSaved();
      else setResult(null);
      return;
    }
    if (key.escape) setResult(null);
  }, { isActive: result !== null });

  const handleSubmit = (values: Values) => {
    setSubmitting(true);
    const vmIdNum = parseInt(values.virtualMachineId, 10);
    const imageId = mode === "edit" ? assignment!.imageId : values.image;
    const picked = images.find((t) => t.id === imageId);
    const promise = mode === "create"
      ? clusterApi.imagesAssign({
        sessionId,
        clusterId,
        nodeId,
        imageId,
        virtualMachineId: vmIdNum,
        storage: values.storage.trim(),
        // Point-in-time snapshot from the catalog row the operator picked.
        name: picked?.name ?? imageId,
        os: picked?.os ?? "",
        sourceUrl: picked?.sourceUrl ?? "",
      })
      : clusterApi.imagesUpdateAssigned({
        sessionId,
        clusterId,
        nodeId,
        imageId,
        virtualMachineId: vmIdNum,
        storage: values.storage.trim(),
      });
    promise
      .then(() => {
        setSubmitting(false);
        const tmplName = mode === "edit" ? assignment!.imageName : (picked?.name ?? "image");
        setResult({
          type: "success",
          summary: `Image '${tmplName}' ${mode === "create" ? "assigned" : "updated"}`,
        });
      })
      .catch((err: Error) => {
        setSubmitting(false);
        setResult({ type: "error", summary: shortError(err.message), detail: err.message });
      });
  };

  const availableImages = mode === "create"
    ? images.filter((t) => !assignedImageIds.has(t.id))
    : [];

  const storageField = (initialValue?: string): Field => ({
    type: "select",
    name: "storage",
    label: "storage",
    required: true,
    initialValue,
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
  });

  const fields: Field[] = mode === "create"
    ? [
      {
        type: "select",
        name: "image",
        label: "image",
        required: true,
        options: availableImages.map((t) => ({ label: t.name, value: t.id })),
        emptyMessage: "no unassigned images available",
      },
      {
        type: "string",
        name: "virtualMachineId",
        label: "vm id",
        required: true,
        sanitize: sanitizeDigits,
        validate: (v) => parseInt(v, 10) > 0 ? null : "must be a positive integer",
      },
      storageField(),
    ]
    : [
      {
        type: "string",
        name: "virtualMachineId",
        label: "vm id",
        required: true,
        initialValue: String(assignment!.virtualMachineId),
        sanitize: sanitizeDigits,
        validate: (v) => parseInt(v, 10) > 0 ? null : "must be a positive integer",
      },
      storageField(assignment!.storage),
    ];

  const subtitle = mode === "create" ? "assign image" : `edit ${assignment?.imageName ?? "image"}`;
  const breadcrumb = ["topologies", clusterName, nodeName, "images", subtitle];

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
      <Box flexDirection="column" gap={1}>
        {submitting && (
          <Spinner label={`${mode === "create" ? "assigning" : "updating"} image...`} />
        )}
        <Form
          fields={fields}
          onSubmit={handleSubmit}
          onCancel={onBack}
          disabled={submitting || result !== null}
        />
      </Box>
    </ScreenFrame>
  );
}
