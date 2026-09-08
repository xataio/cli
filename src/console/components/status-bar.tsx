import { Box, Text } from 'ink';
import type { ConsoleState } from '../types';

export function StatusBar({ state }: { state: ConsoleState }) {
  return (
    <Box paddingX={1} flexDirection="column" flexShrink={0}>
      <Text color="gray">{keyHints(state)}</Text>
      {state.loading ? <Text color="yellow">{state.notice ?? 'Loading…'}</Text> : null}
      {state.error ? <Text color="red">{state.error}</Text> : null}
      {!state.loading && !state.error && state.notice ? <Text color="green">{state.notice}</Text> : null}
    </Box>
  );
}

function keyHints(state: ConsoleState): string {
  if (state.modal?.kind === 'picker') {
    return '↑/↓ or j/k move · enter select · esc cancel';
  }

  if (state.modal?.kind === 'help') {
    return 'esc or q close';
  }

  if (state.modal?.kind === 'create-branch') {
    return 'type name · enter create · esc cancel';
  }

  if (state.modal?.kind === 'confirm-delete') {
    return 'y delete · n or esc cancel';
  }

  if (state.activeView === 'branches') {
    return 'j/k move · enter select · n new branch · d delete · 1-5/tab views · r refresh · ? help · q quit';
  }

  if (state.activeView === 'metrics') {
    return 'space pause · a aggregation · s range · j/k scroll · 1-5/tab views · ? help · q quit';
  }

  if (state.activeView === 'logs') {
    return 'space pause · l level · j/k scroll · G follow · 1-5/tab views · ? help · q quit';
  }

  if (state.activeView === 'insights') {
    return 'space pause · s sort · j/k move · enter details · 1-5/tab views · ? help · q quit';
  }

  return 'o org · p project · b branch · c copy url · x psql · X scratch psql · r refresh · 1-5/tab views · ? help · q quit';
}
