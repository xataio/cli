import type { Types } from '@xata.io/api';
import { Box, Text, useInput } from 'ink';
import { useState } from 'react';
import { formatDate } from '../format';
import { clampSelection, listWindow } from '../navigation';

type BranchesViewProps = {
  branches: Types.BranchListMetadata[];
  currentBranchId?: string;
  isActive: boolean;
  rows: number;
  onSelect: (branchId: string) => void;
  onCreate: (parent?: Types.BranchListMetadata) => void;
  onDelete: (branch: Types.BranchListMetadata) => void;
};

export function BranchesView({
  branches,
  currentBranchId,
  isActive,
  rows,
  onSelect,
  onCreate,
  onDelete
}: BranchesViewProps) {
  const [rawIndex, setIndex] = useState(() =>
    Math.max(
      0,
      branches.findIndex((branch) => branch.id === currentBranchId)
    )
  );
  const index = clampSelection(rawIndex, branches.length);

  useInput(
    (input, key) => {
      if (input === 'n') {
        onCreate(branches[index]);
        return;
      }

      if (branches.length === 0) return;

      if (key.upArrow || input === 'k') {
        setIndex((index - 1 + branches.length) % branches.length);
        return;
      }
      if (key.downArrow || input === 'j') {
        setIndex((index + 1) % branches.length);
        return;
      }
      if (input === 'g') {
        setIndex(0);
        return;
      }
      if (input === 'G') {
        setIndex(branches.length - 1);
        return;
      }
      if (input === 'd') {
        const branch = branches[index];
        if (branch) onDelete(branch);
        return;
      }
      if (key.return) {
        const branch = branches[index];
        if (branch) onSelect(branch.id);
      }
    },
    { isActive }
  );

  if (branches.length === 0) {
    return (
      <Box borderStyle="round" borderColor="gray" paddingX={1} flexDirection="column" flexGrow={1}>
        <Text color="yellow">This project has no branches yet.</Text>
        <Text color="gray">Create one with `xata branch create`, then press r to refresh.</Text>
      </Box>
    );
  }

  const visibleCount = Math.max(3, rows - 12);
  const startIndex = listWindow(index, branches.length, visibleCount);
  const visibleBranches = branches.slice(startIndex, startIndex + visibleCount);
  const hiddenBefore = startIndex;
  const hiddenAfter = Math.max(0, branches.length - startIndex - visibleBranches.length);

  return (
    <Box borderStyle="round" borderColor="green" paddingX={1} flexDirection="column" flexGrow={1}>
      <Box>
        <Box width={2} />
        <Box width={32}>
          <Text bold>name</Text>
        </Box>
        <Box width={18}>
          <Text bold>region</Text>
        </Box>
        <Box width={10}>
          <Text bold>parent</Text>
        </Box>
        <Text bold>created</Text>
      </Box>
      {hiddenBefore > 0 ? <Text color="gray"> … {hiddenBefore} more above</Text> : null}
      {visibleBranches.map((branch, visibleIndex) => {
        const itemIndex = startIndex + visibleIndex;
        const isSelected = itemIndex === index;
        const isCurrent = branch.id === currentBranchId;
        return (
          <Box key={branch.id}>
            <Box width={2}>
              <Text color="cyan">{isSelected ? '›' : ' '}</Text>
            </Box>
            <Box width={32}>
              <Text color={isSelected ? 'cyan' : undefined} wrap="truncate-end">
                {branch.name}
                {isCurrent ? <Text color="green"> ●</Text> : null}
              </Text>
            </Box>
            <Box width={18}>
              <Text color={isSelected ? 'cyan' : 'gray'} wrap="truncate-end">
                {branch.region}
              </Text>
            </Box>
            <Box width={10}>
              <Text color={isSelected ? 'cyan' : 'gray'}>{branch.parentID ? 'child' : 'root'}</Text>
            </Box>
            <Text color={isSelected ? 'cyan' : 'gray'} wrap="truncate-end">
              {formatDate(branch.createdAt)}
            </Text>
          </Box>
        );
      })}
      {hiddenAfter > 0 ? <Text color="gray"> … {hiddenAfter} more below</Text> : null}
      <Box marginTop={1}>
        <Text color="gray">
          {branches.length} branch{branches.length === 1 ? '' : 'es'} · ● current target
        </Text>
      </Box>
    </Box>
  );
}
