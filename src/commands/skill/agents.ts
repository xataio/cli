import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const agentIds = [
  'claude-code',
  'codex',
  'cursor',
  'amp',
  'github-copilot',
  'antigravity-cli',
  'opencode',
  'windsurf',
  'zed',
  'cline'
] as const;
export type AgentId = (typeof agentIds)[number];
type Paths = { home: string; project: string; configHome?: string; claudeConfig?: string; codexHome?: string };

export const getAgents = ({ home, project, configHome, claudeConfig, codexHome }: Paths) => {
  const config = configHome || join(home, '.config');
  const claude = claudeConfig ?? join(home, '.claude');
  return [
    {
      id: 'claude-code',
      label: 'Claude Code',
      project: join(project, '.claude/skills'),
      global: join(claude, 'skills'),
      detected: existsSync(claude) || existsSync(join(project, '.claude'))
    },
    {
      id: 'codex',
      label: 'Codex',
      project: join(project, '.agents/skills'),
      global: join(home, '.agents/skills'),
      detected: existsSync(codexHome ?? join(home, '.codex')) || existsSync(join(project, '.codex'))
    },
    {
      id: 'cursor',
      label: 'Cursor',
      project: join(project, '.agents/skills'),
      global: join(home, '.cursor/skills'),
      detected: existsSync(join(home, '.cursor')) || existsSync(join(project, '.cursor'))
    },
    {
      id: 'amp',
      label: 'Amp',
      project: join(project, '.agents/skills'),
      global: join(config, 'agents/skills'),
      detected: existsSync(join(config, 'amp')) || existsSync(join(project, '.amp'))
    },
    {
      id: 'github-copilot',
      label: 'GitHub Copilot (VS Code)',
      project: join(project, '.agents/skills'),
      global: join(home, '.copilot/skills'),
      detected: existsSync(join(home, '.copilot'))
    },
    {
      id: 'antigravity-cli',
      label: 'Antigravity CLI',
      project: join(project, '.agents/skills'),
      global: join(home, '.gemini/antigravity-cli/skills'),
      detected: existsSync(join(home, '.gemini/antigravity-cli'))
    },
    {
      id: 'opencode',
      label: 'OpenCode',
      project: join(project, '.agents/skills'),
      global: join(config, 'opencode/skills'),
      detected: existsSync(join(config, 'opencode')) || existsSync(join(project, '.opencode'))
    },
    {
      id: 'windsurf',
      label: 'Windsurf',
      project: join(project, '.windsurf/skills'),
      global: join(home, '.codeium/windsurf/skills'),
      detected: existsSync(join(home, '.codeium/windsurf')) || existsSync(join(project, '.windsurf'))
    },
    {
      id: 'zed',
      label: 'Zed',
      project: join(project, '.agents/skills'),
      global: join(home, '.agents/skills'),
      detected: existsSync(join(config, 'zed')) || existsSync(join(project, '.zed'))
    },
    {
      id: 'cline',
      label: 'Cline',
      project: join(project, '.cline/skills'),
      global: join(home, '.cline/skills'),
      detected: existsSync(join(home, '.cline')) || existsSync(join(project, '.cline'))
    }
  ] as const;
};

export const getDestinations = (
  agents: ReturnType<typeof getAgents>,
  selected: readonly string[],
  global: boolean,
  name: string
) => {
  const destinations = new Map<string, { path: string; agents: string[] }>();
  for (const id of selected) {
    const agent = agents.find((agent) => agent.id === id);
    if (!agent) throw new Error(`Unknown agent: ${id}. Supported agents: ${agentIds.join(', ')}`);
    const path = resolve(global ? agent.global : agent.project, name);
    const existing = destinations.get(path);
    if (existing) {
      if (!existing.agents.includes(agent.label)) existing.agents.push(agent.label);
    } else destinations.set(path, { path, agents: [agent.label] });
  }
  return [...destinations.values()];
};
