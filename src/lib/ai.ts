import { z } from 'zod';
import type { XataApi } from '@xata.io/api';
import { generateSQL, generateCloneConfig } from '@xata.io/ai';
import { AI_GATEWAY_MODELS, type AIGatewayModel } from '@xata.io/ai/gateway';
import { createAIGatewayModel } from '@xata.io/ai/gateway/client';
import { resolveConsoleUrl } from './console-url';
import type { CustomConfig } from './schemas';

type AIContext = {
  refreshToken: XataApi['refreshToken'];
  env: { XATA_CONSOLE_URL?: string };
  customConfig?: CustomConfig;
};

export const AI_MODEL_NAMES = Object.keys(AI_GATEWAY_MODELS) as AIGatewayModel[];

const generationFields = {
  prompt: z.string().max(8_000),
  formattedSchema: z.string().min(1).max(100_000)
};
const sqlInputSchema = z.object({
  ...generationFields,
  currentSql: z.string().max(50_000).optional()
});
const cloneInputSchema = z.object({
  ...generationFields,
  currentConfig: z.string().max(100_000).optional()
});

const createXataModel = async (
  context: AIContext,
  organizationId: string,
  model: AIGatewayModel,
  feature: 'cli-sql' | 'cli-clone-config',
  signal: AbortSignal
) => {
  const consoleUrl = resolveConsoleUrl(context.env.XATA_CONSOLE_URL, context.customConfig);
  const token = await context.refreshToken({ signal });
  return createAIGatewayModel({ consoleUrl, organizationId, token, model, feature, signal });
};

export const generateSQLWithXata = async (
  context: AIContext,
  organizationId: string,
  input: { prompt: string; formattedSchema: string; currentSql?: string; model?: AIGatewayModel },
  signal?: AbortSignal
) => {
  const body = sqlInputSchema.parse(input);
  const abortSignal = AbortSignal.any([AbortSignal.timeout(120_000), ...(signal ? [signal] : [])]);
  const model = await createXataModel(
    context,
    organizationId,
    input.model ?? 'claude-sonnet-4-6',
    'cli-sql',
    abortSignal
  );
  return generateSQL(model, body.prompt, body.formattedSchema, body.currentSql, {
    maxOutputTokens: 4_096,
    maxRetries: 0,
    abortSignal
  });
};

export const generateCloneConfigWithXata = async (
  context: AIContext,
  organizationId: string,
  input: { prompt: string; formattedSchema: string; currentConfig?: string; model?: AIGatewayModel }
) => {
  const body = cloneInputSchema.parse(input);
  const abortSignal = AbortSignal.timeout(120_000);
  const model = await createXataModel(
    context,
    organizationId,
    // Gemini populated clone column maps in Gateway smoke tests; Claude returned empty maps. Revisit after investigation.
    input.model ?? 'gemini-2.5-flash',
    'cli-clone-config',
    abortSignal
  );
  return generateCloneConfig(model, body.prompt, body.formattedSchema, body.currentConfig, {
    maxOutputTokens: 8_192,
    maxRetries: 0,
    abortSignal
  });
};
