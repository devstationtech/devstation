/// <reference types="@types/react" />
import { type ReactNode, useState } from "react";
import { Box, Text, useInput } from "ink";
import { HelpBar } from "@ui/shared/help-bar.tsx";
import { ScreenFrame, Spinner, TextInput } from "@ui/shared/design-system/mod.ts";
import { DimText } from "@ui/shared/theme/mod.ts";

type DeleteStep = "confirm" | "deleting" | "done" | "error";

type Props = {
  title: string;
  itemId: string;
  entityLabel?: string;
  /** Optional banner shown above the prompt (e.g. an in-use warning). */
  warning?: ReactNode;
  /**
   * The word that confirms the deletion. Defaults to `itemId` (type the name),
   * matching the rest of the delete screens. Pass a short verb (e.g. "remove")
   * for a guarded, in-use deletion so the operator types one word, not a long id
   * — same idiom as the provisioning confirms ("Type destroy to confirm").
   */
  confirmWord?: string;
  onDelete: () => Promise<unknown>;
  onConfirmed: () => void;
  onBack: () => void;
};

export function ConfirmDeleteScreen(
  { title, itemId, entityLabel, warning, confirmWord, onDelete, onConfirmed, onBack }: Props,
) {
  const [step, setStep] = useState<DeleteStep>("confirm");
  const [input, setInput] = useState("");
  const [error, setError] = useState("");

  const word = confirmWord ?? itemId;

  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const subject = entityLabel ? `${entityLabel} '${itemId}'` : `'${itemId}'`;
  const doneMessage = entityLabel
    ? `${cap(entityLabel)} '${itemId}' removed.`
    : `'${itemId}' removed.`;

  useInput((_char, key) => {
    if (step === "confirm" && key.escape) {
      onBack();
      return;
    }
    if (step === "done" && (key.return || key.escape)) {
      onConfirmed();
      return;
    }
    if (step === "error" && (key.return || key.escape)) {
      onBack();
      return;
    }
  }, { isActive: step !== "deleting" });

  const handleSubmit = (value: string) => {
    if (value.trim().toLowerCase() !== word.toLowerCase()) return;
    setStep("deleting");
    onDelete()
      .then(() => setStep("done"))
      .catch((err: Error) => {
        setError(err.message);
        setStep("error");
      });
  };

  const footer = step === "confirm"
    ? <HelpBar>↵ confirm esc back</HelpBar>
    : step === "done"
    ? <HelpBar>↵/esc back</HelpBar>
    : step === "error"
    ? <HelpBar>↵/esc back</HelpBar>
    : <HelpBar>{`Removing ${subject}...`}</HelpBar>;

  const topRight = step === "done"
    ? <Text color="green">✓ {doneMessage}</Text>
    : step === "error"
    ? <Text color="red">✗ {error}</Text>
    : undefined;

  const intent = step === "done" ? "success" : step === "error" ? "danger" : undefined;

  return (
    <ScreenFrame
      breadcrumb={[title.toLowerCase()]}
      intent={intent}
      topRight={topRight}
      footer={footer}
    >
      {step === "confirm" && (
        <Box flexDirection="column" gap={1}>
          {warning}
          <Text>
            Type <Text color="red">{word}</Text> to confirm deletion of{" "}
            {entityLabel ?? "this item"}:
          </Text>
          <Box gap={1}>
            <Text color="red">❯</Text>
            <TextInput value={input} onChange={setInput} onSubmit={handleSubmit} focus />
          </Box>
        </Box>
      )}
      {step === "deleting" && <Spinner label={`removing ${subject}...`} />}
      {step === "done" && <DimText>Press ↵ or esc to continue.</DimText>}
      {step === "error" && <DimText>Press ↵ or esc to go back.</DimText>}
    </ScreenFrame>
  );
}
