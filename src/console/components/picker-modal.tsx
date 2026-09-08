import { Box, Text } from 'ink';
import { listWindow } from '../navigation';
import type { PickerItem, PickerKind } from '../types';

const MAX_PICKER_ITEMS = 10;

export function PickerModal({ picker, items, index }: { picker: PickerKind; items: PickerItem[]; index: number }) {
  const startIndex = listWindow(index, items.length, MAX_PICKER_ITEMS);
  const visibleItems = items.slice(startIndex, startIndex + MAX_PICKER_ITEMS);
  const hiddenBefore = startIndex;
  const hiddenAfter = Math.max(0, items.length - startIndex - visibleItems.length);

  return (
    <Box borderStyle="round" borderColor="yellow" paddingX={1} flexDirection="column">
      <Text bold color="yellow">
        {pickerTitle(picker)}
      </Text>
      {items.length === 0 ? <Text color="gray">No items</Text> : null}
      {hiddenBefore > 0 ? <Text color="gray"> … {hiddenBefore} more above</Text> : null}
      {visibleItems.map((item, visibleIndex) => {
        const itemIndex = startIndex + visibleIndex;
        return (
          <Text key={item.id} color={itemIndex === index ? 'cyan' : undefined}>
            {itemIndex === index ? '› ' : '  '}
            {item.label} <Text color="gray">{item.description ?? item.id}</Text>
          </Text>
        );
      })}
      {hiddenAfter > 0 ? <Text color="gray"> … {hiddenAfter} more below</Text> : null}
    </Box>
  );
}

function pickerTitle(picker: PickerKind) {
  if (picker === 'organization') return 'Select organization';
  if (picker === 'project') return 'Select project';
  return 'Select branch';
}
