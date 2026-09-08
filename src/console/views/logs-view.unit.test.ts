import { describe, expect, mock, test } from 'bun:test';
import type { Types } from '@xata.io/api';
import { createElement } from 'react';
import type { LocalContext } from '~/context';
import { renderInk, settle, waitFor } from '../ink-test-harness';
import { LogsView } from './logs-view';

type LogsRequest = { body: { start: string; end: string; filters?: Types.LogFilter[] } };
type LogsResponse = { logs: Types.LogEntry[]; nextCursor: null };

function buildContext() {
  const requests: { request: LogsRequest; response: PromiseWithResolvers<LogsResponse> }[] = [];
  const branchLogs = mock((request: LogsRequest) => {
    const response = Promise.withResolvers<LogsResponse>();
    requests.push({ request, response });
    return response.promise;
  });
  const context = { api: { branches: { branchLogs } } } as unknown as LocalContext;

  return { context, requests };
}

function renderLogs(context: LocalContext) {
  return renderInk(
    createElement(LogsView, {
      context,
      organizationId: 'org',
      projectId: 'project',
      branchId: 'branch',
      isActive: true,
      rows: 40
    })
  );
}

const log = {
  timestamp: new Date().toISOString(),
  level: 'info',
  instanceID: 'inst-1',
  process: 'postgres',
  message: 'checkpoint complete'
} as Types.LogEntry;

describe('LogsView polling', () => {
  test('keeps polling after the level filter changes while a request is in flight', async () => {
    const { context, requests } = buildContext();
    const app = renderLogs(context);

    try {
      await waitFor(() => expect(requests).toHaveLength(1));

      app.press('l');
      await waitFor(() => expect(requests).toHaveLength(2));
      expect(requests[1]!.request.body.filters).toEqual([{ field: 'level', op: 'in', values: ['error'] }]);
    } finally {
      app.unmount();
    }
  });

  test('does not consume logs fetched by a poll that was paused before it resolved', async () => {
    const { context, requests } = buildContext();
    const app = renderLogs(context);

    try {
      await waitFor(() => expect(requests).toHaveLength(1));

      app.press(' ');
      await waitFor(() => expect(app.lastFrame()).toContain('paused'));
      requests[0]!.response.resolve({ logs: [log], nextCursor: null });
      await settle();

      app.press(' ');
      await waitFor(() => expect(requests).toHaveLength(2));
      expect(requests[1]!.request.body.start).toBe(requests[0]!.request.body.start);

      requests[1]!.response.resolve({ logs: [log], nextCursor: null });
      await waitFor(() => expect(app.lastFrame()).toContain('checkpoint complete'));
    } finally {
      app.unmount();
    }
  });
});
