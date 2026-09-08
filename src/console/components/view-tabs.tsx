import { Box, Text } from 'ink';
import type { ViewId } from '../types';

const VIEW_TABS: { id: ViewId; shortcut: string; label: string }[] = [
  { id: 'overview', shortcut: '1', label: 'overview' },
  { id: 'branches', shortcut: '2', label: 'branches' },
  { id: 'metrics', shortcut: '3', label: 'metrics' },
  { id: 'logs', shortcut: '4', label: 'logs' },
  { id: 'insights', shortcut: '5', label: 'insights' }
];

export function ViewTabs({ activeView }: { activeView: ViewId }) {
  return (
    <Box paddingX={1}>
      {VIEW_TABS.map((tab) => (
        <Box key={tab.id} marginRight={2}>
          <Text
            color={tab.id === activeView ? 'cyan' : 'gray'}
            bold={tab.id === activeView}
            inverse={tab.id === activeView}
          >
            {` ${tab.shortcut} ${tab.label} `}
          </Text>
        </Box>
      ))}
      <Text color="gray">tab to cycle</Text>
    </Box>
  );
}
