/// <reference types="@types/react" />
import { useEffect, useState } from "react";
import { Box, Text, useInput } from "ink";
import type { ImageRecord } from "@jsonrpc-contracts-ts/image.gen.ts";
import { useImage } from "@ui/rpc-clients-provider.tsx";
import { useSessionId } from "@ui/auth/session-provider.tsx";
import { ImageForm } from "@ui/images/image-form.tsx";
import { ConfirmDeleteScreen } from "@ui/shared/confirm-delete-screen.tsx";
import { HelpBar } from "@ui/shared/help-bar.tsx";
import { ScreenFrame, Table } from "@ui/shared/design-system/mod.ts";
import { useNavigationState } from "@ui/shared/hooks/use-navigation-state.ts";
import { DimText } from "@ui/shared/theme/mod.ts";

type Subscreen = "list" | "detail" | "new" | "edit" | "confirm-delete";

type Props = {
  onBack: () => void;
};

/** One labeled field in the detail view. The value wraps freely (no table). */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box>
      <Box width={12} flexShrink={0}>
        <DimText>{label}</DimText>
      </Box>
      <Box flexGrow={1}>
        <Text>{children}</Text>
      </Box>
    </Box>
  );
}

/**
 * The central image catalog — its own top-level resource under topologies.
 * Registering/editing/removing an image is not scoped to a cluster; assigning
 * a catalog image to a node stays a per-node concern (cluster → node → OS
 * images).
 */
export function ImagesScreen({ onBack }: Props) {
  const imageApi = useImage();
  const sessionId = useSessionId();
  const [images, setImages] = useState<readonly ImageRecord[] | null>(null);
  const [cursor, setCursor] = useNavigationState<number>("images:cursor", 0);
  const [subscreen, setSubscreen] = useState<Subscreen>("list");

  const reload = () =>
    imageApi.list({ sessionId }).then((list) => {
      const sorted = [...list].sort((a, b) => a.name.localeCompare(b.name));
      setImages(sorted);
      setCursor((c) => Math.min(c, Math.max(0, sorted.length - 1)));
    });

  useEffect(() => {
    reload();
  }, []);

  const selected = images && images.length > 0 ? images[cursor] : null;

  useInput((input, key) => {
    if (subscreen === "list") {
      if (key.escape) {
        onBack();
        return;
      }
      if (key.ctrl || key.meta) return;
      if (input === "r") {
        setSubscreen("new");
        return;
      }
      if (!images || images.length === 0) return;
      if (key.return) {
        setSubscreen("detail");
        return;
      }
      if (input === "e") {
        setSubscreen("edit");
        return;
      }
      if (input === "u") {
        setSubscreen("confirm-delete");
        return;
      }
      if (key.upArrow) setCursor((c) => Math.max(0, c - 1));
      if (key.downArrow) setCursor((c) => Math.min(images.length - 1, c + 1));
      return;
    }
    if (subscreen === "detail") {
      if (key.escape) {
        setSubscreen("list");
        return;
      }
      if (key.ctrl || key.meta) return;
      if (input === "e") setSubscreen("edit");
      else if (input === "u") setSubscreen("confirm-delete");
    }
  });

  if (subscreen === "new") {
    return (
      <ImageForm
        mode="create"
        onBack={() => setSubscreen("list")}
        onSaved={() => {
          setSubscreen("list");
          reload();
        }}
      />
    );
  }

  if (subscreen === "edit" && selected) {
    return (
      <ImageForm
        mode="edit"
        image={{
          id: selected.id,
          name: selected.name,
          sourceUrl: selected.sourceUrl,
          os: selected.os,
        }}
        onBack={() => setSubscreen("list")}
        onSaved={() => {
          setSubscreen("list");
          reload();
        }}
      />
    );
  }

  if (subscreen === "confirm-delete" && selected) {
    const usages = selected.usages;
    const inUse = usages.length > 0;
    const warning = inUse
      ? (
        <Box flexDirection="column" gap={1}>
          <Text color="yellow">
            ⚠ '{selected.name}' is in use by {usages.length}{" "}
            node(s). Deleting it removes it from the catalog only — assigned nodes keep it and can
            still provision VMs, but it can no longer be assigned to new nodes.
          </Text>
          <Box flexDirection="column">
            {usages.map((u) => (
              <DimText key={`${u.clusterId}:${u.nodeId}`}>
                • {u.clusterName} / {u.nodeName}
              </DimText>
            ))}
          </Box>
        </Box>
      )
      : undefined;
    return (
      <ConfirmDeleteScreen
        title="unregister image"
        itemId={selected.name}
        entityLabel="image"
        warning={warning}
        confirmWord={inUse ? "unregister" : undefined}
        onDelete={() => imageApi.unregister({ sessionId, id: selected.id })}
        onConfirmed={() => {
          setSubscreen("list");
          reload();
        }}
        onBack={() => setSubscreen("list")}
      />
    );
  }

  if (subscreen === "detail" && selected) {
    const usages = selected.usages;
    return (
      <ScreenFrame
        breadcrumb={["topologies", "images", selected.name]}
        footer={<HelpBar>e edit u unregister esc back</HelpBar>}
      >
        <Box flexDirection="column" gap={1}>
          <Box flexDirection="column">
            <Field label="name">{selected.name}</Field>
            <Field label="os">{selected.os}</Field>
            <Field label="source url">{selected.sourceUrl}</Field>
            <Field label="id">{selected.id}</Field>
            <Field label="in use">
              {usages.length === 0 ? "not assigned to any node" : `${usages.length} node(s)`}
            </Field>
          </Box>
          {usages.length > 0 && (
            <Box flexDirection="column">
              {usages.map((u) => (
                <DimText key={`${u.clusterId}:${u.nodeId}`}>
                  • {u.clusterName} / {u.nodeName}
                </DimText>
              ))}
            </Box>
          )}
        </Box>
      </ScreenFrame>
    );
  }

  const hasItems = (images?.length ?? 0) > 0;
  const rows = (images ?? []).map((i) => ({
    name: i.name,
    os: i.os,
    "in use": String(i.usages.length),
  }));

  return (
    <ScreenFrame
      breadcrumb={["topologies", "images"]}
      footer={
        <HelpBar>
          {hasItems
            ? "↵ details   r register   e edit   u unregister   esc back"
            : "r register   esc back"}
        </HelpBar>
      }
    >
      {images === null ? <DimText>Loading...</DimText> : (
        <Table
          rows={rows}
          columns={[
            { key: "name" },
            { key: "os" },
            { key: "in use", align: "right" },
          ]}
          focusedIndex={hasItems ? cursor : undefined}
          emptyMessage="No images registered. Press r to register one."
        />
      )}
    </ScreenFrame>
  );
}
