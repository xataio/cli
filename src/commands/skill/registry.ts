import { parse } from 'yaml';
import { z } from 'zod';

export const repository = 'xataio/skills';
export const metadataFile = '.xata-skill.json';
const nameSchema = z
  .string()
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const entrySchema = z.object({ path: z.string(), mode: z.string(), type: z.string(), size: z.number().optional() });
type Entry = z.infer<typeof entrySchema>;
export type Skill = { name: string; description: string; path: string };
export type Registry = { commit: string; skills: Skill[]; entries: Entry[] };
export type SkillFile = { path: string; content: Buffer; executable: boolean };

const fetchBytes = async (url: string, limit = 2 * 1024 * 1024) => {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) {
    throw new Error(
      `Could not fetch skills (${response.status}). GitHub may be unavailable or rate-limiting requests.`
    );
  }
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (!response.body) throw new Error('Empty response from the skills registry.');
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > limit) throw new Error('Skills registry response exceeds the download limit.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
};

const fetchJson = async (path: string) =>
  JSON.parse((await fetchBytes(`https://api.github.com/repos/${repository}/${path}`)).toString());
const fetchFile = (commit: string, path: string) =>
  fetchBytes(
    `https://raw.githubusercontent.com/${repository}/${commit}/${path.split('/').map(encodeURIComponent).join('/')}`
  );

export const validatePaths = (entries: Entry[]) => {
  const paths = new Set<string>();
  for (const entry of entries) {
    const parts = entry.path.split('/');
    if (
      parts.some(
        (part) =>
          !part ||
          part === '.' ||
          part === '..' ||
          /[\\<>:"|?*]/.test(part) ||
          [...part].some((character) => character.charCodeAt(0) < 32) ||
          /[. ]$/.test(part) ||
          /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part)
      )
    ) {
      throw new Error(`Unsafe skill path: ${entry.path}`);
    }
    if (
      !(
        (entry.type === 'tree' && entry.mode === '040000') ||
        (entry.type === 'blob' && ['100644', '100755'].includes(entry.mode))
      )
    ) {
      throw new Error(`Unsupported skill entry: ${entry.path}`);
    }
    const key = entry.path.toLowerCase();
    if (paths.has(key)) throw new Error(`Colliding skill path: ${entry.path}`);
    paths.add(key);
  }
};

export const readRegistry = async (): Promise<Registry> => {
  const { sha: commit } = z.object({ sha: z.string().regex(/^[a-f0-9]{40}$/) }).parse(await fetchJson('commits/HEAD'));
  const tree = z
    .object({ truncated: z.boolean(), tree: z.array(entrySchema).max(5000) })
    .parse(await fetchJson(`git/trees/${commit}?recursive=1`));
  if (tree.truncated) throw new Error('GitHub returned an incomplete skills registry.');
  const entries = tree.tree.filter((entry) => entry.path.startsWith('skills/'));
  validatePaths(entries);
  const skills: Skill[] = [];
  for (const entry of entries.filter((entry) => /^skills\/[^/]+\/SKILL\.md$/.test(entry.path))) {
    const name = nameSchema.parse(entry.path.split('/')[1]);
    const text = (await fetchFile(commit, entry.path)).toString();
    const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text)?.[1];
    if (!frontmatter) throw new Error(`Missing frontmatter in ${entry.path}`);
    const data = z
      .object({ name: nameSchema, description: z.string().trim().min(1).max(1024) })
      .parse(parse(frontmatter));
    if (data.name !== name) throw new Error(`Skill name does not match its directory: ${entry.path}`);
    skills.push({ ...data, path: `skills/${name}` });
  }
  return { commit, skills: skills.sort((a, b) => a.name.localeCompare(b.name)), entries };
};

export const downloadSkill = async (registry: Registry, skill: Skill): Promise<SkillFile[]> => {
  const entries = registry.entries.filter((entry) => entry.path.startsWith(`${skill.path}/`) && entry.type === 'blob');
  if (entries.length > 500) throw new Error('Skill contains too many files.');
  const files: SkillFile[] = [];
  let size = 0;
  for (const entry of entries) {
    const path = entry.path.slice(skill.path.length + 1);
    if (path.toLowerCase() === metadataFile) throw new Error(`Reserved skill filename: ${path}`);
    const content = await fetchFile(registry.commit, entry.path);
    size += content.length;
    if (size > 20 * 1024 * 1024) throw new Error('Skill exceeds the download limit.');
    files.push({ path, content, executable: entry.mode === '100755' });
  }
  files.push({
    path: metadataFile,
    executable: false,
    content: Buffer.from(
      `${JSON.stringify({ version: 1, repository, commit: registry.commit, path: skill.path }, null, 2)}\n`
    )
  });
  return files;
};
