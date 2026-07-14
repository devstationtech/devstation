/// <reference types="@types/react" />
import { Box, Text } from "ink";
import { colors } from "@ui/shared/design-system/tokens.ts";

export type TabBarItem = {
  id: string;
  label: string;
};

type Props = {
  items: TabBarItem[];
  currentId: string;
};

export function TabBar({ items, currentId }: Props) {
  return (
    <Box gap={2}>
      {items.map((item) => {
        const isCurrent = item.id === currentId;
        return (
          <Text
            key={item.id}
            color={isCurrent ? colors.primary : colors.muted}
            bold={isCurrent}
            underline={isCurrent}
          >
            {item.label}
          </Text>
        );
      })}
    </Box>
  );
}
