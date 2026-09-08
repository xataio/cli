import { Box, Text, useInput } from 'ink';
import { useState } from 'react';

type CreateBranchModalProps = {
  parentBranchName: string;
  isActive: boolean;
  onSubmit: (name: string) => void;
  onCancel: () => void;
};

export function CreateBranchModal({ parentBranchName, isActive, onSubmit, onCancel }: CreateBranchModalProps) {
  const [name, setName] = useState('');

  useInput(
    (input, key) => {
      if (key.escape) {
        onCancel();
        return;
      }
      if (key.return) {
        const trimmed = name.trim();
        if (trimmed) onSubmit(trimmed);
        return;
      }
      if (key.backspace || key.delete) {
        setName((value) => value.slice(0, -1));
        return;
      }
      if (key.ctrl || key.meta || key.tab || key.upArrow || key.downArrow || key.leftArrow || key.rightArrow) {
        return;
      }
      const printable = input.replace(/[^\u0021-\u007e]/g, '');
      if (printable) {
        setName((value) => value + printable);
      }
    },
    { isActive }
  );

  return (
    <Box borderStyle="round" borderColor="magenta" paddingX={1} flexDirection="column">
      <Text bold color="magenta">
        Create child branch
      </Text>
      <Box>
        <Box width={10}>
          <Text color="gray">parent</Text>
        </Box>
        <Text>{parentBranchName}</Text>
      </Box>
      <Box>
        <Box width={10}>
          <Text color="gray">name</Text>
        </Box>
        <Text>
          {name}
          <Text color="magenta">█</Text>
        </Text>
      </Box>
      <Box marginTop={1}>
        <Text color="gray">enter create · esc cancel</Text>
      </Box>
    </Box>
  );
}
