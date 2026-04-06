import { Box, Text, useApp } from "ink";
import SelectInput from "ink-select-input";
import { useEffect } from "react";

interface Props {
  candidates: string[];
  query?: string;
  onSelect: (profileName: string) => void;
  onEmpty?: () => void;
}

export const SelectProfile: React.FC<Props> = ({ candidates, query, onSelect, onEmpty }) => {
  const { exit } = useApp();
  const items = candidates.map((name) => ({
    label: name,
    value: name,
  }));

  useEffect(() => {
    if (items.length === 0) {
      onEmpty?.();
      exit();
    }
  }, [exit, items.length, onEmpty]);

  if (items.length === 0) {
    return (
      <Box flexDirection="column">
        <Text color="yellow">No profiles found.</Text>
        <Text>Run `gitface new` to create one.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text bold>Select a profile to use:</Text>
      {query ? (
        <Text>
          Filtered by query: <Text color="cyan">{query}</Text>
        </Text>
      ) : null}
      <SelectInput
        items={items}
        onSelect={(item) => {
          onSelect(item.value);
          exit();
        }}
      />
    </Box>
  );
};
