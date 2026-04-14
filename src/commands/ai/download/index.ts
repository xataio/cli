import { buildRouteMap } from '@stricli/core';
import { AiDownloadClaudeSkill } from './claude-skill';

export const AiDownloadRoute = buildRouteMap({
  docs: {
    brief: `Download Xata's AI helpers for other platforms like Anthropic/Claude`
  },
  routes: {
    'claude-skill': AiDownloadClaudeSkill
  }
});
