import { buildCommand } from '@stricli/core';
import type { LocalContext } from '~/context';
import { renderTable } from '~/lib/table';
import { readRegistry, repository } from './registry';

export const implementation = async function (this: LocalContext) {
  const { commit, skills } = await readRegistry();
  if (this.outputJson) {
    this.printTable(this, { repository, commit, skills });
    return;
  }
  const nameWidth = Math.max(5, ...skills.map((skill) => skill.name.length)) + 1;
  const width = Math.max(nameWidth + 20, Math.min(this.process.stdout.columns ?? 100, 120));
  const table = renderTable(
    ['Skill', 'Description'],
    skills.map((skill) => [skill.name, skill.description]),
    { colWidths: [nameWidth, width - nameWidth - 1], wordWrap: true }
  );
  this.process.stdout.write(
    `${table}\n\nInstall with: xata skill install <name> --agent <agent>\nSee supported agents: xata skill install --help\n`
  );
};

export const SkillListCommand = buildCommand({
  docs: { brief: 'List available skills from xataio/skills' },
  parameters: {},
  func: implementation
});
