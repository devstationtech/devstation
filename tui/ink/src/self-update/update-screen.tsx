/// <reference types="@types/react" />
import { useEffect, useState } from "react";
import { Box, Text, useInput } from "ink";
import { ScreenFrame, Spinner } from "@ui/shared/design-system/mod.ts";
import { HelpBar } from "@ui/shared/help-bar.tsx";
import { DimText } from "@ui/shared/theme/mod.ts";
import { VERSION } from "@ui/cli/version.ts";
import { checkForUpdate, currentTarget, type UpdateStatus } from "@ui/self-update/mod.ts";
import {
  type BinaryInstaller,
  createInstaller,
  type InstallOutcome,
  type InstallPhase,
} from "@ui/self-update/mod.ts";

type Phase =
  | { kind: "checking" }
  | { kind: "ready"; status: Extract<UpdateStatus, { kind: "available" }> }
  | { kind: "current" }
  | { kind: "unavailable"; reason: string }
  | { kind: "installing"; step: InstallPhase }
  | { kind: "done"; outcome: InstallOutcome }
  | { kind: "rolled"; message: string };

type Props = {
  onBack: () => void;
  // Seams for tests.
  check?: typeof checkForUpdate;
  installer?: BinaryInstaller;
};

export function UpdateScreen({ onBack, check = checkForUpdate, installer }: Props) {
  const [phase, setPhase] = useState<Phase>({ kind: "checking" });

  useEffect(() => {
    let alive = true;
    check({ force: true }).then((status) => {
      if (!alive) return;
      if (status.kind === "available") setPhase({ kind: "ready", status });
      else if (status.kind === "current") setPhase({ kind: "current" });
      else if (status.kind === "skipped") {
        setPhase({ kind: "unavailable", reason: skipReason(status.reason) });
      } else setPhase({ kind: "unavailable", reason: "could not reach the update server" });
    });
    return () => {
      alive = false;
    };
  }, [check]);

  const startInstall = async (status: Extract<UpdateStatus, { kind: "available" }>) => {
    const target = currentTarget();
    const asset = target ? status.manifest.assets[target] : undefined;
    if (!target || !asset) {
      setPhase({
        kind: "unavailable",
        reason: `no published asset for this platform (${target ?? "unknown"})`,
      });
      return;
    }
    const inst = installer ?? createInstaller();
    setPhase({ kind: "installing", step: "download" });
    const outcome = await inst.install({
      asset,
      version: status.manifest.version,
      onProgress: (step) => setPhase({ kind: "installing", step }),
    });
    setPhase({ kind: "done", outcome });
  };

  const rollback = async () => {
    const inst = installer ?? createInstaller();
    const outcome = await inst.rollback();
    if (outcome.kind === "rolled-back") {
      setPhase({
        kind: "rolled",
        message: "Rolled back. Restart devstation to use the previous version.",
      });
    } else if (outcome.kind === "nothing") {
      setPhase({ kind: "rolled", message: "Nothing to roll back to." });
    } else {
      setPhase({ kind: "unavailable", reason: outcome.reason });
    }
  };

  useInput((input, key) => {
    if (key.escape) {
      onBack();
      return;
    }
    if (phase.kind === "ready" && key.return) {
      void startInstall(phase.status);
      return;
    }
    if (
      (phase.kind === "ready" || phase.kind === "current" || phase.kind === "unavailable") &&
      input === "r"
    ) {
      void rollback();
      return;
    }
    if (
      (phase.kind === "done" || phase.kind === "current" || phase.kind === "unavailable" ||
        phase.kind === "rolled") && key.return
    ) {
      onBack();
    }
  });

  return (
    <ScreenFrame
      breadcrumb={["update"]}
      boxLayout="top"
      footer={<HelpBar>{helpFor(phase)}</HelpBar>}
    >
      <Box flexDirection="column" gap={1}>
        <DimText>current version: v{VERSION}</DimText>
        {renderBody(phase)}
      </Box>
    </ScreenFrame>
  );
}

function renderBody(phase: Phase) {
  switch (phase.kind) {
    case "checking":
      return <Spinner label="checking for updates…" />;
    case "current":
      return <Text color="green">You're on the latest version.</Text>;
    case "unavailable":
      return <Text color="yellow">{phase.reason}</Text>;
    case "ready":
      return (
        <Box flexDirection="column">
          <Text color="yellow">v{phase.status.latest} is available.</Text>
          <DimText>press ↵ to download and install · esc to cancel</DimText>
        </Box>
      );
    case "installing":
      return <Spinner label={`${installLabel(phase.step)}…`} />;
    case "done":
      return renderOutcome(phase.outcome);
    case "rolled":
      return <Text color="green">{phase.message}</Text>;
  }
}

function renderOutcome(outcome: InstallOutcome) {
  if (outcome.kind === "installed") {
    return (
      <Box flexDirection="column">
        <Text color="green">Updated. Restart devstation to use the new version.</Text>
        <DimText>previous binary kept at {outcome.previous}</DimText>
      </Box>
    );
  }
  if (outcome.kind === "staged") {
    return (
      <Text color="green">
        Update downloaded. Close and reopen devstation to apply v{outcome.version}.
      </Text>
    );
  }
  return <Text color="red">Update failed: {outcome.reason}</Text>;
}

function installLabel(step: InstallPhase): string {
  switch (step) {
    case "download":
      return "downloading";
    case "verify":
      return "verifying checksum";
    case "extract":
      return "extracting";
    case "install":
      return "installing";
  }
}

function skipReason(reason: string): string {
  switch (reason) {
    case "dev":
      return "this is a development build — updates are disabled";
    case "disabled":
      return "update checks are disabled (DEVSTATION_DISABLE_UPDATE_CHECK)";
    case "unsupported-target":
      return "no published binary for this platform";
    default:
      return "update check skipped";
  }
}

function helpFor(phase: Phase): string {
  if (phase.kind === "ready") return "↵ install · r rollback · esc back";
  if (phase.kind === "done" || phase.kind === "rolled") return "↵ back · esc back";
  if (phase.kind === "installing" || phase.kind === "checking") return "esc back";
  return "r rollback · esc back";
}
