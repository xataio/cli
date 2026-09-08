import { describe, expect, mock, test } from 'bun:test';
import { createElement } from 'react';
import type { LocalContext } from '~/context';
import { renderInk, waitFor } from '../ink-test-harness';
import { MetricsView } from './metrics-view';

type MetricsRequest = { body: { start: string; end: string } };
type MetricsResponse = { results: never[] };

function buildContext() {
  const requests: { request: MetricsRequest; response: PromiseWithResolvers<MetricsResponse> }[] = [];
  const branchMetrics = mock((request: MetricsRequest) => {
    const response = Promise.withResolvers<MetricsResponse>();
    requests.push({ request, response });
    return response.promise;
  });
  const context = {
    api: {
      branches: {
        getBranchPostgresConfig: mock(async () => ({ parameters: [] })),
        branchMetrics
      }
    }
  } as unknown as LocalContext;

  return { context, requests };
}

describe('MetricsView polling', () => {
  test('keeps polling after the time range changes while a request is in flight', async () => {
    const { context, requests } = buildContext();
    const app = renderInk(
      createElement(MetricsView, {
        context,
        organizationId: 'org',
        projectId: 'project',
        branchId: 'branch',
        branchName: 'main',
        instances: [{ id: 'inst-1', primary: true }],
        isActive: true,
        rows: 40
      })
    );

    try {
      await waitFor(() => expect(requests).toHaveLength(1));

      app.press('s');
      await waitFor(() => expect(requests).toHaveLength(2));
      expect(new Date(requests[1]!.request.body.start) < new Date(requests[0]!.request.body.start)).toBe(true);

      requests[0]!.response.resolve({ results: [] });
      requests[1]!.response.resolve({ results: [] });
      await waitFor(() => expect(app.lastFrame()).toContain('last 6h'));
      expect(app.lastFrame()).toContain('updated');
    } finally {
      app.unmount();
    }
  });
});
