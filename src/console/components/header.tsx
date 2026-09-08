import { Box, Text } from 'ink';
import type { ConsoleState } from '../types';

export function Header({ state }: { state: ConsoleState }) {
  const organization = state.data?.organizations.find((item) => item.id === state.scope?.organizationId);
  const project = state.data?.projects.find((item) => item.id === state.scope?.projectId);
  const branchId = state.scope?.kind === 'branch' ? state.scope.branchId : undefined;
  const branch = state.data?.branches.find((item) => item.id === branchId);

  return (
    <Box borderStyle="round" borderColor="cyan" paddingX={1} flexDirection="column">
      <Box>
        <Text bold color="cyan">
          xata console
        </Text>
        <Text>
          {'  '}org: <Text color="green">{organization?.name ?? state.scope?.organizationId ?? '—'}</Text> · project:{' '}
          <Text color="green">{project?.name ?? state.scope?.projectId ?? '—'}</Text> · branch:{' '}
          <Text color="green">{branch?.name ?? branchId ?? 'none'}</Text>
        </Text>
      </Box>
    </Box>
  );
}
