import { Box, Text, useInput } from 'ink';

type ConfirmModalProps = {
  title: string;
  lines: string[];
  warning?: string;
  isActive: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmModal({ title, lines, warning, isActive, onConfirm, onCancel }: ConfirmModalProps) {
  useInput(
    (input, key) => {
      if (input === 'y') {
        onConfirm();
        return;
      }
      if (input === 'n' || key.escape) {
        onCancel();
      }
    },
    { isActive }
  );

  return (
    <Box borderStyle="round" borderColor="red" paddingX={1} flexDirection="column">
      <Text bold color="red">
        {title}
      </Text>
      {lines.map((line) => (
        <Text key={line}>{line}</Text>
      ))}
      {warning ? <Text color="yellow">{warning}</Text> : null}
      <Box marginTop={1}>
        <Text color="gray">
          press <Text color="red">y</Text> to confirm · n or esc to cancel
        </Text>
      </Box>
    </Box>
  );
}
