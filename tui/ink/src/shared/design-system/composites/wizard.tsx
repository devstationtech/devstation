/// <reference types="@types/react" />
import { useState } from "react";
import { Box, Text, useInput } from "ink";
import { type Field, Form, type Values } from "@ui/shared/design-system/composites/form.tsx";
import { TabBar } from "@ui/shared/design-system/primitives/tab-bar.tsx";
import { colors } from "@ui/shared/design-system/tokens.ts";
import { DimText } from "@ui/shared/theme/mod.ts";

export type WizardSection = {
  id: string;
  label: string;
  fields?: Field[];
};

type Props = {
  sections: WizardSection[];
  value: Values;
  onChange: (values: Values) => void;
  onSubmit: (values: Values) => void;
  onCancel?: () => void;
  disabled?: boolean;
};

export function Wizard({ sections, value, onChange, onSubmit, onCancel, disabled = false }: Props) {
  const [section, setSection] = useState(0);

  useInput((char, key) => {
    if (key.ctrl && char === "x") {
      onCancel?.();
      return;
    }
    if (key.leftArrow && section > 0) {
      setSection((s) => s - 1);
      return;
    }
    if (key.rightArrow && section < sections.length - 1) {
      setSection((s) => s + 1);
      return;
    }
  }, { isActive: !disabled });

  const current = sections[section];
  const isFirst = section === 0;
  const isLast = section === sections.length - 1;

  const goNext = () => {
    if (isLast) onSubmit(value);
    else setSection(section + 1);
  };
  const goBack = () => {
    if (isFirst) onCancel?.();
    else setSection(section - 1);
  };

  return (
    <Box flexDirection="column" gap={1}>
      <TabBar items={sections.map((s) => ({ id: s.id, label: s.label }))} currentId={current.id} />
      {current.fields
        ? (
          <Form
            key={current.id}
            fields={current.fields}
            value={value}
            onChange={onChange}
            onSubmit={goNext}
            onCancel={goBack}
            disabled={disabled}
          />
        )
        : (
          <Review
            sections={sections}
            value={value}
            onSubmit={goNext}
            onCancel={goBack}
            disabled={disabled}
          />
        )}
    </Box>
  );
}

type ReviewProps = {
  sections: WizardSection[];
  value: Values;
  onSubmit: () => void;
  onCancel: () => void;
  disabled?: boolean;
};

function Review({ sections, value, onSubmit, onCancel, disabled = false }: ReviewProps) {
  useInput((_char, key) => {
    if (key.return) {
      onSubmit();
      return;
    }
    if (key.escape) {
      onCancel();
      return;
    }
  }, { isActive: !disabled });

  return (
    <Box flexDirection="column" gap={1}>
      {sections.filter((s) => s.fields).map((s) => (
        <Box key={s.id} flexDirection="column">
          <Text bold>{s.label}</Text>
          {s.fields!.map((f) => {
            const raw = value[f.name] ?? "";
            const display = formatFieldValue(f, raw);
            return (
              <Box key={f.name} gap={1}>
                <DimText>{f.label}:</DimText>
                <Text>{display}</Text>
              </Box>
            );
          })}
        </Box>
      ))}
      <Text color={colors.success} bold>↵ confirm and submit</Text>
    </Box>
  );
}

function formatFieldValue(field: Field, raw: string): string {
  if (field.type === "boolean") return raw === "true" ? "yes" : "no";
  if (field.type === "select") {
    const opt = field.options.find((o) => o.value === raw);
    return opt?.label ?? raw ?? "—";
  }
  if (field.mask) return field.mask.repeat(raw.length);
  return raw || "—";
}
