/// <reference types="@types/react" />
import { useEffect, useMemo, useRef, useState } from "react";
import { Box, Text, useInput } from "ink";
import { TextInput } from "@ui/shared/design-system/primitives/text-input.tsx";
import { Select, type SelectItem } from "@ui/shared/design-system/primitives/select.tsx";
import { Spinner } from "@ui/shared/design-system/primitives/spinner.tsx";
import { DimText } from "@ui/shared/theme/mod.ts";

const CREATE_PREFIX = "__form_create__";
const createValue = (idx: number) => `${CREATE_PREFIX}${idx}`;
const parseCreateIndex = (v: string) =>
  v.startsWith(CREATE_PREFIX) ? parseInt(v.slice(CREATE_PREFIX.length), 10) : -1;

export type CreateOption = {
  label: string;
  intent: "silent" | "prompt";
  promptLabel?: string;
  promptHint?: string | (() => string);
  promptPlaceholder?: string;
  /** Pre-fills the prompt input — useful when the handler already has a sensible default. */
  promptInitialValue?: string | (() => string);
  promptMask?: string;
  handler: (input?: string) => Promise<string>;
};

export type StringField = {
  type: "string";
  name: string;
  label: string;
  description?: string;
  required?: boolean;
  initialValue?: string;
  placeholder?: string;
  mask?: string;
  sanitize?: (value: string) => string;
  validate?: (value: string) => string | null;
};

export type SelectOption = { label: string; value: string; secondary?: string | string[] };

export type SelectField = {
  type: "select";
  name: string;
  label: string;
  description?: string;
  required?: boolean;
  initialValue?: string;
  options: SelectOption[];
  emptyMessage?: string;
  createOptions?: CreateOption[];
};

export type BooleanField = {
  type: "boolean";
  name: string;
  label: string;
  description?: string;
  initialValue?: boolean;
};

export type Field = StringField | SelectField | BooleanField;

export type Values = Record<string, string>;

type Props = {
  fields: Field[];
  value?: Values;
  onChange?: (values: Values) => void;
  onSubmit: (values: Values) => void;
  onCancel?: () => void;
  disabled?: boolean;
};

function validateField(field: Field, value: string): string | null {
  if (field.type === "string") {
    if (field.required && !value.trim()) return "required";
    if (field.validate) return field.validate(value);
  } else if (field.type === "select") {
    if (field.required && !value) return "required";
  }
  return null;
}

function selectedLabel(field: SelectField, value: string): string {
  return field.options.find((o) => o.value === value)?.label ?? "";
}

function buildInitial(fields: Field[]): Values {
  const init: Values = {};
  for (const f of fields) {
    if (f.type === "boolean") init[f.name] = (f.initialValue ?? false) ? "true" : "false";
    else init[f.name] = f.initialValue ?? "";
  }
  return init;
}

type PromptState = { fieldName: string; value: string; option: CreateOption };

export function Form({ fields, value, onChange, onSubmit, onCancel, disabled = false }: Props) {
  const isControlled = value !== undefined;
  const [internalValues, setInternalValues] = useState<Values>(() => buildInitial(fields));
  const values = isControlled ? value : internalValues;

  const [focusIndex, setFocusIndex] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<PromptState | null>(null);
  const advanceQueuedRef = useRef(false);
  const skipNextAdvanceRef = useRef(false);

  const labelWidth = useMemo(
    () => Math.max(...fields.map((f) => f.label.length + 1)),
    [fields],
  );

  // Mirror of `values` updated synchronously on commit so handlers fired in
  // the same input tick (Select's `onCommit` followed by `onAdvance`) see the
  // freshly-set value instead of the stale closure snapshot.
  const valuesRef = useRef(values);
  useEffect(() => {
    valuesRef.current = values;
  }, [values]);

  const commit = (next: Values) => {
    valuesRef.current = next;
    if (!isControlled) setInternalValues(next);
    onChange?.(next);
  };

  const advance = (i: number, latest: Values) => {
    if (i < fields.length - 1) {
      setFocusIndex(i + 1);
      return;
    }
    const all: Record<string, string> = {};
    let ok = true;
    for (const ff of fields) {
      const e = validateField(ff, latest[ff.name] ?? "");
      if (e) {
        all[ff.name] = e;
        ok = false;
      }
    }
    if (!ok) {
      setErrors(all);
      const firstBad = fields.findIndex((ff) => all[ff.name]);
      if (firstBad >= 0) setFocusIndex(firstBad);
      return;
    }
    onSubmit(latest);
  };

  const tryAdvanceFromCurrent = () => {
    const f = fields[focusIndex];
    const latest = valuesRef.current;
    const v = latest[f.name] ?? "";
    const error = validateField(f, v);
    if (error) {
      setErrors((prev) => ({ ...prev, [f.name]: error }));
      return;
    }
    setErrors((prev) => ({ ...prev, [f.name]: "" }));
    advance(focusIndex, latest);
  };

  useInput((char, key) => {
    if (key.ctrl && char === "x") {
      onCancel?.();
      return;
    }
    if (prompt) {
      if (key.escape) {
        setPrompt(null);
        return;
      }
      return;
    }
    if (pending) return;
    if (key.escape) {
      if (focusIndex > 0) setFocusIndex((i) => Math.max(0, i - 1));
      else onCancel?.();
      return;
    }
    if (key.shift && key.tab) {
      setFocusIndex((i) => Math.max(0, i - 1));
      return;
    }
    if (key.tab) {
      tryAdvanceFromCurrent();
      return;
    }
  }, { isActive: !disabled });

  const handleStringSubmit = (i: number, valueIn: string) => {
    const f = fields[i] as StringField;
    const error = validateField(f, valueIn);
    if (error) {
      setErrors((prev) => ({ ...prev, [f.name]: error }));
      return;
    }
    setErrors((prev) => ({ ...prev, [f.name]: "" }));
    const next = { ...values, [f.name]: valueIn };
    advance(i, next);
  };

  const runCreate = async (i: number, option: CreateOption, input?: string) => {
    const f = fields[i];
    setPending(f.name);
    try {
      const newVal = await option.handler(input);
      const next = { ...values, [f.name]: newVal };
      commit(next);
      setErrors((prev) => ({ ...prev, [f.name]: "" }));
      setPending(null);
      if (advanceQueuedRef.current || option.intent === "prompt") {
        advanceQueuedRef.current = false;
        advance(i, next);
      }
    } catch (err) {
      setErrors((prev) => ({ ...prev, [f.name]: (err as Error).message }));
      setPending(null);
      advanceQueuedRef.current = false;
    }
  };

  const handleSelectCommit = (i: number, item: SelectItem<string>) => {
    const f = fields[i] as SelectField;
    const createIdx = parseCreateIndex(item.value);
    if (createIdx >= 0 && f.createOptions && f.createOptions[createIdx]) {
      const opt = f.createOptions[createIdx];
      skipNextAdvanceRef.current = true;
      if (opt.intent === "silent") {
        advanceQueuedRef.current = true;
        runCreate(i, opt);
      } else {
        const initial = typeof opt.promptInitialValue === "function"
          ? opt.promptInitialValue()
          : opt.promptInitialValue ?? "";
        setPrompt({ fieldName: f.name, value: initial, option: opt });
      }
      return;
    }
    const next = { ...values, [f.name]: item.value };
    commit(next);
    setErrors((prev) => ({ ...prev, [f.name]: "" }));
  };

  const handleSelectAdvance = (_i: number) => {
    if (skipNextAdvanceRef.current) {
      skipNextAdvanceRef.current = false;
      return;
    }
    if (prompt) return;
    if (pending) {
      advanceQueuedRef.current = true;
      return;
    }
    tryAdvanceFromCurrent();
  };

  const handlePromptChange = (v: string) => {
    setPrompt((p) => p ? { ...p, value: v } : null);
  };

  const handlePromptSubmit = (v: string) => {
    if (!prompt) return;
    if (!v.trim()) return;
    const idx = fields.findIndex((ff) => ff.name === prompt.fieldName);
    const opt = prompt.option;
    setPrompt(null);
    if (idx >= 0) runCreate(idx, opt, v.trim());
  };

  const indent = " ".repeat(labelWidth + 1);

  return (
    <Box flexDirection="column">
      {fields.map((f, i) => {
        const isFocused = focusIndex === i;
        const labelText = `${f.label}:`.padEnd(labelWidth);
        const isInPrompt = prompt && prompt.fieldName === f.name;
        const isPending = pending === f.name;
        return (
          <Box key={f.name} flexDirection="column">
            <Box>
              <Text color={isFocused ? "white" : undefined} bold={isFocused}>{labelText}</Text>
              <Text></Text>
              {f.type === "string" && !isInPrompt && (
                <TextInput
                  value={values[f.name] ?? ""}
                  onChange={(v) => commit({ ...values, [f.name]: v })}
                  onSubmit={(v) => handleStringSubmit(i, v)}
                  focus={isFocused && !disabled}
                  placeholder={f.placeholder}
                  mask={f.mask}
                  sanitize={f.sanitize}
                />
              )}
              {f.type === "select" && !isFocused && !isInPrompt && (
                <DimText>{selectedLabel(f, values[f.name] ?? "")}</DimText>
              )}
              {f.type === "boolean" && !isFocused && (
                <DimText>{values[f.name] === "true" ? "yes" : "no"}</DimText>
              )}
              {isPending && <Spinner label="creating..." />}
            </Box>

            {isInPrompt && prompt && (() => {
              const hint = typeof prompt.option.promptHint === "function"
                ? prompt.option.promptHint()
                : prompt.option.promptHint;
              return (
                <Box marginLeft={labelWidth - 1}>
                  <Text>{prompt.option.promptLabel ?? "value"}</Text>
                  {hint && <Text color="yellow">({hint})</Text>}
                  <Text>:</Text>
                  <TextInput
                    value={prompt.value}
                    onChange={handlePromptChange}
                    onSubmit={handlePromptSubmit}
                    focus
                    placeholder={prompt.option.promptPlaceholder}
                    mask={prompt.option.promptMask}
                  />
                </Box>
              );
            })()}

            {f.type === "select" && isFocused && !isInPrompt && !isPending && (
              (() => {
                const items: SelectItem<string>[] = [];
                if (f.createOptions) {
                  f.createOptions.forEach((co, idx) =>
                    items.push({ label: co.label, value: createValue(idx) })
                  );
                }
                for (const o of f.options) {
                  items.push({ label: o.label, value: o.value, secondary: o.secondary });
                }
                if (items.length === 0) {
                  return <DimText>{indent}{f.emptyMessage ?? "no options available"}</DimText>;
                }
                return (
                  <Box marginLeft={labelWidth - 1}>
                    <Select
                      items={items}
                      onCommit={(item) => handleSelectCommit(i, item)}
                      onAdvance={() => handleSelectAdvance(i)}
                      isFocused={!disabled}
                      initialIndex={Math.max(
                        0,
                        items.findIndex((it) => it.value === (values[f.name] ?? "")),
                      )}
                      currentValue={values[f.name]}
                    />
                  </Box>
                );
              })()
            )}

            {f.type === "boolean" && isFocused && (
              <Box marginLeft={labelWidth - 1}>
                <Select
                  items={[
                    { label: "yes", value: "true" },
                    { label: "no", value: "false" },
                  ]}
                  onCommit={(item) => handleSelectCommit(i, item)}
                  onAdvance={() => handleSelectAdvance(i)}
                  isFocused={!disabled}
                  initialIndex={values[f.name] === "false" ? 1 : 0}
                  currentValue={values[f.name]}
                />
              </Box>
            )}

            {f.description && isFocused && <DimText italic>{indent}{f.description}</DimText>}
            {errors[f.name] && <Text color="red">{indent}{errors[f.name]}</Text>}
          </Box>
        );
      })}
    </Box>
  );
}
