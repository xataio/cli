import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test';
import { XataApi } from '@xata.io/api';
import { generateCloneConfigWithXata, generateSQLWithXata } from './ai';
import { DEFAULT_API_BASE_URL, DEFAULT_API_ISSUER } from './constants';

const input = { prompt: 'Count orders', formattedSchema: 'CREATE TABLE orders (id integer);' };
const modelResponse = (output: unknown) =>
  Response.json({
    content: [{ type: 'text', text: JSON.stringify(output) }],
    finishReason: { unified: 'stop', raw: 'end_turn' },
    usage: { inputTokens: { total: 17 }, outputTokens: { total: 9 } },
    warnings: []
  });
const createContext = () => ({
  env: { XATA_WEBAPP_URL: undefined },
  apiBaseUrl: DEFAULT_API_BASE_URL,
  apiIssuer: DEFAULT_API_ISSUER,
  refreshToken: mock(async () => 'refreshed-xata-token')
});

afterEach(() => mock.restore());

describe('Xata AI client', () => {
  test('uses refreshed Xata credentials and validates the SQL response without BYOK', async () => {
    const fetch = spyOn(globalThis, 'fetch').mockResolvedValue(modelResponse({ sql: 'SELECT count(*) FROM orders;' }));
    const context = createContext();

    expect(await generateSQLWithXata(context, 'org-a', { ...input, currentSql: 'SELECT id FROM orders;' })).toBe(
      'SELECT count(*) FROM orders;'
    );
    expect(context.refreshToken).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, options] = fetch.mock.calls[0] ?? [];
    expect(url).toBe('https://console.xata.io/api/ai/org-a/language-model');
    expect(options).toMatchObject({
      method: 'POST',
      redirect: 'error',
      headers: {
        authorization: 'Bearer refreshed-xata-token',
        'ai-language-model-id': 'anthropic/claude-sonnet-4.6',
        'x-xata-ai-protocol': '1'
      }
    });
    expect(context.refreshToken).toHaveBeenCalledWith({ signal: expect.any(AbortSignal) });
    const body = JSON.parse(options?.body as string);
    expect(body.maxOutputTokens).toBe(4096);
    expect(body.responseFormat.type).toBe('json');
    expect(body.prompt[0].content).toContain(input.formattedSchema);
    expect(body.prompt[1].content[0].text).toContain('SELECT id FROM orders;');
    expect(body.prompt[1].content[0].text).toContain(input.prompt);
  });

  test.each([{ apiBaseUrl: 'https://api.staging.example' }, { apiIssuer: 'https://auth.staging.example' }])(
    'does not send custom-backend credentials to the production console (%j)',
    async (custom) => {
      const fetch = spyOn(globalThis, 'fetch');
      const context = { ...createContext(), ...custom };
      await expect(generateSQLWithXata(context, 'org-a', input)).rejects.toThrow('XATA_WEBAPP_URL');
      expect(context.refreshToken).not.toHaveBeenCalled();
      expect(fetch).not.toHaveBeenCalled();
    }
  );

  test('sends clone validation feedback and the prior config to the explicit endpoint', async () => {
    const config = { transformations: { validation_mode: 'strict' as const, table_transformers: [] } };
    const fetch = spyOn(globalThis, 'fetch').mockResolvedValue(modelResponse(config));
    const context = {
      ...createContext(),
      env: { XATA_WEBAPP_URL: 'https://console.staging.example/' }
    };
    const body = {
      ...input,
      prompt: 'Fix: masking cannot handle jsonb',
      currentConfig: 'transformations: {}',
      model: 'claude-haiku-4-5-20251001' as const
    };
    expect(await generateCloneConfigWithXata(context, 'org-b', body)).toEqual(config);
    expect(fetch.mock.calls[0]?.[0]).toBe('https://console.staging.example/api/ai/org-b/language-model');
    const sent = JSON.parse(fetch.mock.calls[0]?.[1]?.body as string);
    expect(sent.maxOutputTokens).toBe(8192);
    expect(sent.prompt[1].content[0].text).toContain(body.prompt);
    expect(sent.prompt[1].content[0].text).toContain(body.currentConfig);
    expect(fetch.mock.calls[0]?.[1]?.headers).toMatchObject({ 'ai-language-model-id': 'anthropic/claude-haiku-4.5' });
  });

  test('defaults clone config generation to Gemini', async () => {
    const config = { transformations: { validation_mode: 'strict' as const, table_transformers: [] } };
    const fetch = spyOn(globalThis, 'fetch').mockResolvedValue(modelResponse(config));
    await generateCloneConfigWithXata(createContext(), 'org-a', input);
    expect(fetch.mock.calls[0]?.[1]?.headers).toMatchObject({ 'ai-language-model-id': 'google/gemini-2.5-flash' });
  });

  test('accepts inputs at the size limits and rejects anything larger before sending a request', async () => {
    const config = { transformations: { validation_mode: 'strict' as const, table_transformers: [] } };
    const fetch = spyOn(globalThis, 'fetch').mockResolvedValue(modelResponse(config));
    const largest = {
      prompt: 'p'.repeat(8_000),
      formattedSchema: 's'.repeat(100_000),
      currentConfig: 'c'.repeat(100_000)
    };
    expect(await generateCloneConfigWithXata(createContext(), 'org-a', largest)).toEqual(config);
    for (const field of ['prompt', 'formattedSchema', 'currentConfig'] as const) {
      await expect(
        generateCloneConfigWithXata(createContext(), 'org-a', { ...largest, [field]: `${largest[field]}x` })
      ).rejects.toThrow();
    }
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test.each(['sql-cancel', 'sql-timeout', 'clone-timeout'] as const)(
    'aborts a stalled token refresh without sending a proxy request: %s',
    async (scenario) => {
      const requested: string[] = [];
      const fetched = Promise.withResolvers<void>();
      const proxyFetch = spyOn(globalThis, 'fetch').mockResolvedValue(modelResponse({ sql: 'SELECT 1;' }));
      const authFetch = (url: string, init?: { signal?: AbortSignal }) =>
        new Promise<Response>((_, reject) => {
          requested.push(url);
          fetched.resolve();
          if (!init?.signal) return reject(new Error('Token refresh sent without an abort signal'));
          init.signal.addEventListener('abort', () => reject(init.signal?.reason));
        });
      const controller = new AbortController();
      const timeout = spyOn(AbortSignal, 'timeout');
      if (scenario !== 'sql-cancel') timeout.mockReturnValue(controller.signal);
      const onTokenRefresh = mock();
      const api = new XataApi({
        token: {
          type: 'oidc',
          client: { issuer: 'https://auth.example', clientId: 'cli', clientSecret: 'fixture-secret' },
          accessToken: 'expired-access',
          refreshToken: 'fixture-refresh',
          expiresAt: new Date(0)
        },
        callbacks: { onTokenRefresh },
        fetch: authFetch
      });
      const context = { ...createContext(), refreshToken: api.refreshToken.bind(api) };
      const reason = new DOMException('Generation stopped', scenario === 'sql-cancel' ? 'AbortError' : 'TimeoutError');
      const pending =
        scenario === 'clone-timeout'
          ? generateCloneConfigWithXata(context, 'org-a', input)
          : generateSQLWithXata(context, 'org-a', input, scenario === 'sql-cancel' ? controller.signal : undefined);
      await fetched.promise;
      expect(requested).toEqual(['https://auth.example/protocol/openid-connect/token']);
      controller.abort(reason);
      await expect(pending).rejects.toMatchObject({ name: reason.name });
      expect(requested).toHaveLength(1);
      expect(proxyFetch).not.toHaveBeenCalled();
      expect(onTokenRefresh).not.toHaveBeenCalled();
      expect(api.token).toMatchObject({ accessToken: 'expired-access', refreshToken: 'fixture-refresh' });
      if (scenario !== 'sql-cancel') expect(timeout).toHaveBeenCalledWith(120_000);
    }
  );

  test('forwards cancellation from the TUI to the HTTP request', async () => {
    const fetch = spyOn(globalThis, 'fetch').mockResolvedValue(modelResponse({ sql: 'SELECT 1;' }));
    const controller = new AbortController();
    await generateSQLWithXata(createContext(), 'org-a', input, controller.signal);
    const signal = fetch.mock.calls[0]?.[1]?.signal;
    expect(signal?.aborted).toBe(false);
    controller.abort();
    expect(signal?.aborted).toBe(true);
    expect(signal?.reason).toBe(controller.signal.reason);
  });

  test('surfaces proxy errors without retrying paid inference', async () => {
    const fetch = spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({ error: { type: 'forbidden', message: 'AI is not enabled' } }, { status: 403 })
    );
    await expect(generateSQLWithXata(createContext(), 'org-a', input)).rejects.toThrow('AI is not enabled');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
