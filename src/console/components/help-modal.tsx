import { Box, Text } from 'ink';
import type { ViewId } from '../types';

type HelpSection = { title: string; entries: [string, string][] };

const VIEWS_SECTION: HelpSection = {
  title: 'Views',
  entries: [
    ['1-5', 'switch view'],
    ['tab / shift+tab', 'next / prev view']
  ]
};

const SELECTION_SECTION: HelpSection = {
  title: 'Selection',
  entries: [
    ['o', 'pick organization'],
    ['p', 'pick project'],
    ['b', 'pick branch']
  ]
};

const LISTS_SECTION: HelpSection = {
  title: 'Lists',
  entries: [
    ['j/k or ↑/↓', 'move selection'],
    ['g / G', 'first / last item'],
    ['enter', 'select item'],
    ['esc', 'close overlay']
  ]
};

const ACTIONS_SECTION: HelpSection = {
  title: 'Actions',
  entries: [
    ['c', 'copy connection string'],
    ['x', 'psql on current branch'],
    ['X', 'psql on scratch branch'],
    ['r', 'refresh data'],
    ['?', 'toggle this help'],
    ['q / ctrl+c', 'quit']
  ]
};

const VIEW_SECTIONS: Record<Exclude<ViewId, 'overview'>, HelpSection> = {
  branches: {
    title: 'Branches view',
    entries: [
      ['n', 'create child branch'],
      ['d', 'delete selected branch']
    ]
  },
  metrics: {
    title: 'Metrics view',
    entries: [
      ['space', 'pause / resume polling'],
      ['a', 'cycle aggregation'],
      ['s', 'cycle time range'],
      ['j/k', 'scroll metrics']
    ]
  },
  logs: {
    title: 'Logs view',
    entries: [
      ['space', 'pause / resume tailing'],
      ['l', 'cycle level filter'],
      ['j/k', 'scroll logs'],
      ['G', 'jump to latest and follow']
    ]
  },
  insights: {
    title: 'Insights view',
    entries: [
      ['space', 'pause / resume polling'],
      ['s', 'cycle sort'],
      ['j/k', 'move selection'],
      ['enter', 'open query details'],
      ['esc', 'close query details']
    ]
  }
};

export function HelpModal({ activeView }: { activeView: ViewId }) {
  const viewSection = activeView === 'overview' ? undefined : VIEW_SECTIONS[activeView];
  const right = viewSection ? [ACTIONS_SECTION, viewSection] : [ACTIONS_SECTION];

  return (
    <Box borderStyle="round" borderColor="cyan" paddingX={1} flexDirection="column" flexShrink={0}>
      <Text bold color="cyan">
        Keyboard shortcuts
      </Text>
      <Box columnGap={2}>
        <HelpColumn sections={[VIEWS_SECTION, SELECTION_SECTION, LISTS_SECTION]} />
        <HelpColumn sections={right} />
      </Box>
    </Box>
  );
}

function HelpColumn({ sections }: { sections: HelpSection[] }) {
  const keyWidth = Math.max(...sections.flatMap((section) => section.entries.map(([keys]) => keys.length))) + 2;

  return (
    <Box flexDirection="column" flexGrow={1} flexBasis={0} minWidth={0}>
      {sections.map((section) => (
        <Box key={section.title} flexDirection="column">
          <Text bold>{section.title}</Text>
          {section.entries.map(([keys, description]) => (
            <Box key={keys}>
              <Box width={keyWidth} flexShrink={0}>
                <Text color="cyan">{keys}</Text>
              </Box>
              <Text wrap="truncate-end">{description}</Text>
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  );
}
