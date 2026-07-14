/// <reference types="@types/react" />
import { useEffect, useState } from "react";
import { Text, useInput } from "ink";
import { DimText } from "@ui/shared/theme/mod.ts";

const BLINK_MS = 500;

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: (value: string) => void;
  placeholder?: string;
  mask?: string;
  focus?: boolean;
  sanitize?: (value: string) => string;
};

export function TextInput(
  { value, onChange, onSubmit, placeholder, mask, focus = true, sanitize }: Props,
) {
  const [blinkOn, setBlinkOn] = useState(true);

  useEffect(() => {
    if (!focus) {
      setBlinkOn(false);
      return;
    }
    setBlinkOn(true);
    const id = setInterval(() => setBlinkOn((v) => !v), BLINK_MS);
    return () => clearInterval(id);
  }, [focus]);

  const setVal = (next: string) => {
    onChange(sanitize ? sanitize(next) : next);
  };

  useInput((input, key) => {
    if (key.ctrl || key.meta) return;
    if (key.escape || key.tab || (key.shift && key.tab)) return;
    if (key.upArrow || key.downArrow || key.leftArrow || key.rightArrow) return;
    if (key.return) {
      onSubmit?.(value);
      return;
    }
    if (key.backspace || key.delete) {
      setVal(value.slice(0, -1));
      return;
    }
    if (input) setVal(value + input);
  }, { isActive: focus });

  const display = mask ? mask.repeat(value.length) : value;

  if (display.length === 0 && !focus && placeholder) {
    return <DimText>{placeholder}</DimText>;
  }

  const cursor = focus ? (blinkOn ? "█" : " ") : "";

  return <Text>{display}{cursor}</Text>;
}
