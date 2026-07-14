/// <reference types="@types/react" />
import { useState } from "react";
import { Box, useInput } from "ink";
import type { ReactNode } from "react";
import { TabBar } from "@ui/shared/design-system/primitives/tab-bar.tsx";

export type Tab = {
  id: string;
  label: string;
  render: () => ReactNode;
};

type Props = {
  tabs: Tab[];
  initialId?: string;
  activeId?: string;
  onChange?: (id: string) => void;
  isFocused?: boolean;
};

export function Tabs({ tabs, initialId, activeId, onChange, isFocused = true }: Props) {
  const [internalId, setInternalId] = useState(initialId ?? tabs[0].id);
  const isControlled = activeId !== undefined;
  const currentId = isControlled ? activeId : internalId;
  const activeIdx = tabs.findIndex((t) => t.id === currentId);
  const active = activeIdx >= 0 ? tabs[activeIdx] : tabs[0];

  const setActive = (id: string) => {
    if (!isControlled) setInternalId(id);
    onChange?.(id);
  };

  useInput((_char, key) => {
    if (key.leftArrow && activeIdx > 0) setActive(tabs[activeIdx - 1].id);
    if (key.rightArrow && activeIdx < tabs.length - 1) setActive(tabs[activeIdx + 1].id);
  }, { isActive: isFocused });

  return (
    <Box flexDirection="column" gap={1}>
      <TabBar items={tabs.map((t) => ({ id: t.id, label: t.label }))} currentId={active.id} />
      {active.render()}
    </Box>
  );
}
