import { buildCommand } from '@stricli/core';
import type { LocalContext } from '~/context';

type Flags = {
  directory: string;
};

const BASE_URL = 'https://xata.io';
const BASE_PATH = 'xata-claude-skill';
const DEFAULT_TARGET_DIR = '.claude/skills/xata';

type FilesResponse = {
  files: string[];
};

export async function implementation(this: LocalContext, flags: Flags) {
  const targetPath = this.path.join(this.process.cwd(), flags.directory);

  if (this.fs.existsSync(targetPath)) {
    this.fs.rmSync(targetPath, { recursive: true });
  }
  this.fs.mkdirSync(targetPath, { recursive: true });

  const filesResponse = await fetch(`${BASE_URL}/api/${BASE_PATH}/files`);
  if (!filesResponse.ok) {
    throw new Error(`Failed to fetch file list: ${filesResponse.statusText}`);
  }

  const { files } = (await filesResponse.json()) as FilesResponse;

  for (const filePath of files) {
    const fileName = this.path.basename(filePath);
    const fileUrl = `${BASE_URL}/${BASE_PATH}/${encodeURIComponent(fileName)}`;

    const fileResponse = await fetch(fileUrl);
    if (!fileResponse.ok) {
      throw new Error(`Failed to download ${fileName}: ${fileResponse.statusText}`);
    }

    const content = await fileResponse.text();
    const destinationPath = this.path.join(targetPath, fileName);

    this.fs.writeFileSync(destinationPath, content);
    this.process.stdout.write(`Downloaded: ${fileName}\n`);
  }

  this.process.stdout.write(`\nXata Claude Skill downloaded to ${flags.directory}\n`);
}

export const AiDownloadClaudeSkill = buildCommand({
  docs: {
    brief: 'Download the Xata Claude Skill'
  },
  parameters: {
    flags: {
      directory: {
        kind: 'parsed',
        brief: 'Target directory for the skill files',
        parse: String,
        default: DEFAULT_TARGET_DIR
      }
    }
  },
  func: implementation
});
