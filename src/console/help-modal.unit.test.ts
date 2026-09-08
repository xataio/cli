import { describe, expect, test } from 'bun:test';
import { Box, renderToString } from 'ink';
import { createElement } from 'react';
import { HelpModal } from './components/help-modal';

describe('HelpModal', () => {
  test('fits an 80-column terminal with the tallest view section', () => {
    const output = renderToString(
      createElement(
        Box,
        { paddingX: 1, flexDirection: 'column' },
        createElement(HelpModal, { activeView: 'insights' })
      ),
      { columns: 80 }
    );

    expect(output.split('\n').length).toBeLessThanOrEqual(16);
    expect(output).not.toContain('…');
    expect(output).toContain('Insights view');
    expect(output).toContain('close query details');
    expect(output).toContain('q / ctrl+c');
    expect(output).not.toContain('Logs view');
  });
});
