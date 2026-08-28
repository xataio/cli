import chalk from 'chalk';
import invariant from 'tiny-invariant';
import { decodeJwt } from 'jose';
import { ApiError } from '@xata.io/api';
import type { LocalContext } from '~/context';
import { branchConfig, branchConfigFileDeclares, getBranchConfigPath } from './branch-config';
import { config } from './config';
import { CLI_NAME } from './constants';
import { envNameFor } from './env';
import { getProfile } from './profile';
import { getProjectConfigPath, projectConfig } from './project-config';
import { renderTable } from './table';

export const print = (
  context: LocalContext,
  json: boolean,
  data: Record<string, unknown> | Record<string, unknown>[],
  headers: string[] = [],
  rows: string[][] = []
) => {
  if (json) {
    context.process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
    return JSON.stringify(data, null, 2);
  }

  const table = renderTable(headers, rows);
  context.process.stdout.write(`${table}\n`);
  return table;
};

/**
 * The env adapter overrides the JSON one, so a configured value names whichever of the two it
 * actually came from. Reporting "config" for both is what made the values in xataio/cli#6 look
 * like they were being used when they were not.
 */
const configuredSource = (key: string, configPath: string) => {
  return envNameFor(key) ?? configPath;
};

const debugResolved = (context: LocalContext, name: string, value: string, source: string) => {
  if (!context.debug) {
    return;
  }
  context.process.stdout.write(`DEBUG: ${name} = ${value || '(empty)'} (from ${source})\n`);
};

type BaseOptions = {
  title?: string;
};

type OrganizationOptions = BaseOptions & {
  organizationName?: string;
};

export const getOrganization = async (
  context: LocalContext,
  flags: { organization?: string },
  options: OrganizationOptions
) => {
  if (options.organizationName && flags.organization) {
    return exitWithError(context, 'Pass the organization either as --organization <id> or as an argument, not both.');
  }
  if (options.organizationName) {
    const organization = await getOrganizationByName(context, {
      organizationName: options.organizationName
    });
    debugResolved(context, 'organization', organization.id, `the ${options.organizationName} argument`);
    return organization.id;
  }
  const title = options?.title || 'Select an organization';
  if (flags.organization) {
    debugResolved(context, 'organization', flags.organization, '--organization');
    return flags.organization;
  }
  if (projectConfig.organizationId) {
    debugResolved(
      context,
      'organization',
      projectConfig.organizationId,
      configuredSource('organizationId', getProjectConfigPath())
    );
    return projectConfig.organizationId;
  }

  const organizationsQuery = await context.api.organizations.getOrganizationsList();
  if (organizationsQuery.organizations.length === 0) {
    return exitWithError(
      context,
      `No organizations found. Create one with \`${CLI_NAME} organization create\`, or run \`${CLI_NAME} auth status\` to check who you are logged in as.`
    );
  }
  if (organizationsQuery.organizations.length === 1) {
    const firstOrganization = organizationsQuery.organizations?.[0];
    invariant(firstOrganization, 'organization is null');
    debugResolved(context, 'organization', firstOrganization.id, 'the only organization on this account');
    return firstOrganization.id;
  } else {
    const choices = organizationsQuery.organizations.map((org) => ({
      name: org.id,
      message: org.name
    }));
    const organizationId = await context.enquirer.selectPrompt(context.isInteractive, title, choices);
    if (!organizationId) {
      return exitWithError(
        context,
        `No organization selected. Pass --organization <id> or set XATA_ORGANIZATION_ID. Run \`${CLI_NAME} organization list\` to see them.`
      );
    }
    debugResolved(context, 'organization', organizationId, 'the prompt');
    return organizationId;
  }
};

export type ProjectOptions = BaseOptions & {
  organizationId: string;
  projectName?: string;
};

/** The configured project belongs to the configured organization, so it cannot answer for another one. */
const configuredProjectFor = (organizationId: string) => {
  if (projectConfig.organizationId && projectConfig.organizationId !== organizationId) {
    return '';
  }
  return projectConfig.projectId;
};

/** The checked out branch belongs to the configured project, so it cannot answer for another one. */
const configuredBranchFor = (projectId: string) => {
  if (projectConfig.projectId && projectConfig.projectId !== projectId) {
    return '';
  }
  return branchConfig.branchId;
};

export const getProject = async (context: LocalContext, flags: { project?: string }, options: ProjectOptions) => {
  if (options.projectName && flags.project) {
    return exitWithError(context, 'Pass the project either as --project <id> or as an argument, not both.');
  }
  if (options.projectName) {
    const project = await getProjectByName(context, {
      organizationId: options.organizationId,
      projectName: options.projectName
    });
    debugResolved(context, 'project', project.id, `the ${options.projectName} argument`);
    return project.id;
  }
  const title = options?.title || 'Select a project';
  if (flags.project) {
    debugResolved(context, 'project', flags.project, '--project');
    return flags.project;
  }
  const configuredProject = configuredProjectFor(options.organizationId);
  if (configuredProject) {
    debugResolved(context, 'project', configuredProject, configuredSource('projectId', getProjectConfigPath()));
    return configuredProject;
  }

  const projectsQuery = await context.api.projects.listProjects({
    pathParams: { organizationID: options?.organizationId }
  });
  if (projectsQuery.projects.length === 0) {
    return exitWithError(
      context,
      `No projects found in organization ${options.organizationId}. Create one with \`${CLI_NAME} project create\`.`
    );
  }
  if (projectsQuery.projects.length === 1) {
    const firstProject = projectsQuery.projects?.[0];
    invariant(firstProject, 'project is null');
    debugResolved(context, 'project', firstProject.id, 'the only project in this organization');
    return firstProject.id;
  } else {
    const choices = projectsQuery.projects.map((project) => ({
      name: project.id,
      message: `${project.id} - ${project.name}`
    }));
    const projectId = await context.enquirer.selectPrompt(context.isInteractive, title, choices);
    if (!projectId) {
      return exitWithError(
        context,
        `No project selected. Pass --project <id> or set XATA_PROJECT_ID. Run \`${CLI_NAME} project list --organization ${options.organizationId}\` to see them.`
      );
    }
    debugResolved(context, 'project', projectId, 'the prompt');
    return projectId;
  }
};

type BranchOptions = BaseOptions & {
  organizationId: string;
  projectId: string;
  skipProjectConfig?: boolean;
  branchName?: string;
  skipPrompt?: boolean;
};

export const getBranch = async (
  context: LocalContext,
  flags: { branch?: string },
  { skipPrompt = false, ...options }: BranchOptions
) => {
  if (options.branchName && flags.branch) {
    return exitWithError(context, 'Pass the branch either as --branch <id> or as an argument, not both.');
  }
  const branchIdOrName = options.branchName ?? flags.branch;
  if (branchIdOrName) {
    const branchId = await resolveBranchIdOrName(context, branchIdOrName, options);
    if (!branchId) {
      return exitWithUnknownBranch(context, 'branch', branchIdOrName);
    }
    debugResolved(context, 'branch', branchId, options.branchName ? `the ${branchIdOrName} argument` : '--branch');
    return branchId;
  }
  const configuredBranch = options.skipProjectConfig ? '' : configuredBranchFor(options.projectId);
  if (configuredBranch) {
    debugResolved(context, 'branch', configuredBranch, configuredSource('branchId', getBranchConfigPath()));
    return configuredBranch;
  }

  const title = options.title || 'Select a branch';

  const { branches } = await context.api.branches.listBranches({
    pathParams: { organizationID: options.organizationId, projectID: options.projectId }
  });

  if (branches.length === 0) {
    // `branch list` and `branch tree` render an empty project, everything else has nothing to target.
    if (!skipPrompt) {
      return exitWithError(
        context,
        `No branches found in this project. Create one with \`${CLI_NAME} branch create\`.`
      );
    }
    return '';
  }

  const branchId =
    branches.length === 1
      ? (branches[0]?.id ?? '')
      : await context.enquirer.selectPrompt(
          context.isInteractive && !skipPrompt,
          title,
          branches.map((branch) => ({ name: branch.id, message: `${branch.id} - ${branch.name}` }))
        );

  // Commands that opt out of the prompt only use the branch to highlight the current one.
  if (!skipPrompt && !branchId) {
    return exitWithError(
      context,
      `No branch selected. Pass --branch <id> or set XATA_BRANCH_ID. Run \`${CLI_NAME} branch list --organization ${options.organizationId} --project ${options.projectId}\` to see them.`
    );
  }
  debugResolved(context, 'branch', branchId, branches.length === 1 ? 'the only branch in this project' : 'the prompt');
  return branchId;
};

export const getCheckedOutBranch = async () => {
  return branchConfig.branchId || null;
};

export const getDatabase = async (flags: { database?: string }) => {
  return flags.database || branchConfig.databaseName;
};

const databaseSource = (flags: { database?: string }) => {
  if (flags.database) {
    return '--database';
  }
  return (
    envNameFor('databaseName') ??
    (branchConfigFileDeclares('databaseName') ? getBranchConfigPath() : `the ${CLI_NAME} default`)
  );
};

export type ContextFlags = {
  organization?: string;
  project?: string;
  branch?: string;
  database?: string;
};

export type ResolvedContext = {
  organizationId: string;
  projectId: string;
  branchId: string;
  database: string;
};

export const contextFlags = {
  organization: { kind: 'parsed', parse: String, brief: 'Organization ID', optional: true },
  project: { kind: 'parsed', parse: String, brief: 'Project ID', optional: true },
  branch: { kind: 'parsed', parse: String, brief: 'Branch ID or name', optional: true },
  database: { kind: 'parsed', parse: String, brief: 'Database name on the branch', optional: true }
} as const;

/** Resolves the branch a command targets, each value from its own flag, env var or config entry. */
export const resolveContext = async (context: LocalContext, flags: ContextFlags): Promise<ResolvedContext> => {
  const organizationId = await context.getOrganization(context, flags, {});
  const projectId = await context.getProject(context, flags, { organizationId });
  const branchId = await context.getBranch(context, flags, { organizationId, projectId });
  const database = await context.getDatabase(flags);
  debugResolved(context, 'database', database, databaseSource(flags));

  return { organizationId, projectId, branchId, database };
};

export const branchPathParams = ({ organizationId, projectId, branchId }: ResolvedContext) => {
  return { organizationID: organizationId, projectID: projectId, branchID: branchId };
};

export type BranchLookupOptions = {
  organizationId: string;
  projectId: string;
};

/** Branch IDs are a UUID in unpadded base32hex, never starting with a digit (maki `internal/idgen`). */
const BRANCH_ID_PATTERN = /^[a-v][0-9a-v]{25}$/;

async function findBranchById(context: LocalContext, branchId: string, options: BranchLookupOptions) {
  try {
    const branch = await context.api.branches.describeBranch({
      pathParams: { organizationID: options.organizationId, projectID: options.projectId, branchID: branchId }
    });
    return branch.id;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return undefined;
    }
    throw error;
  }
}

async function findBranchIdByName(context: LocalContext, branchName: string, options: BranchLookupOptions) {
  const { branches } = await context.api.branches.listBranches({
    pathParams: { organizationID: options.organizationId, projectID: options.projectId }
  });
  return branches.find((branch) => branch.name === branchName)?.id;
}

export const resolveBranchIdOrName = async (
  context: LocalContext,
  branchIdOrName: string,
  options: BranchLookupOptions
) => {
  const lookups = BRANCH_ID_PATTERN.test(branchIdOrName)
    ? [findBranchById, findBranchIdByName]
    : [findBranchIdByName, findBranchById];

  for (const lookup of lookups) {
    const branchId = await lookup(context, branchIdOrName, options);
    if (branchId) {
      return branchId;
    }
  }

  return undefined;
};

/** `invariant` drops its message when NODE_ENV is production, which is where the CLI runs in CI. */
export function exitWithError(context: LocalContext, message: string): never {
  context.process.stderr.write(chalk.red(`${message}\n`));
  return context.process.exit(1);
}

export function exitWithUnknownBranch(context: LocalContext, label: string, branchIdOrName: string): never {
  return exitWithError(
    context,
    `Invalid ${label}: ${branchIdOrName}. No branch in this project has that ID or name. Run \`${CLI_NAME} branch list\` to see them.`
  );
}

type GetOrganizationByNameOptions = {
  organizationName: string;
};

async function getOrganizationByName(context: LocalContext, options: GetOrganizationByNameOptions) {
  const { organizationName } = options;
  const { organizations } = await context.api.organizations.getOrganizationsList();
  const organization = organizations.find((org) => org.name === organizationName);
  if (!organization) {
    return exitWithError(
      context,
      `Invalid organization: ${organizationName}. No organization you belong to has that name. Run \`${CLI_NAME} organization list\` to see them.`
    );
  }
  return organization;
}

type GetProjectByNameOptions = {
  organizationId: string;
  projectName: string;
};

async function getProjectByName(context: LocalContext, options: GetProjectByNameOptions) {
  const { organizationId, projectName } = options;
  const { projects } = await context.api.projects.listProjects({
    pathParams: { organizationID: organizationId }
  });
  const project = projects.find((proj) => proj.name === projectName);
  if (!project) {
    return exitWithError(
      context,
      `Invalid project: ${projectName}. No project in this organization has that name. Run \`${CLI_NAME} project list --organization ${organizationId}\` to see them.`
    );
  }
  return project;
}

export function getUserInfo(profileFlag?: string): { name?: string; email?: string } {
  const profile = getProfile({ profileFlag });
  const profileData = config?.profiles?.[profile];

  if (profileData?.type !== 'oidc' || !profileData.accessToken) {
    return {};
  }

  try {
    const payload = decodeJwt(profileData.accessToken) as Record<string, any>;
    return { name: payload.name, email: payload.email };
  } catch {
    return {};
  }
}

type Region = {
  id: string;
  publicAccess: boolean;
  backupsEnabled: boolean;
  provider: 'aws' | 'gcp' | 'custom';
  organizationId: string | null;
};

const regionProviderLabels = {
  aws: 'AWS',
  gcp: 'GCP',
  custom: 'Custom'
} satisfies Record<Region['provider'], string>;

const regionProviderColors = {
  aws: chalk.hex('#FF9900'),
  gcp: chalk.hex('#4285F4'),
  custom: chalk.gray
} satisfies Record<Region['provider'], (text: string) => string>;

function formatRegionProvider(provider: Region['provider']) {
  const label = `(${regionProviderLabels[provider]})`;
  return regionProviderColors[provider](label);
}

function formatRegionChoiceMessage(region: Region, group?: 'Organization' | 'Global') {
  const prefix = group ? `[${group}] ` : '';
  return `${prefix}${region.id} ${formatRegionProvider(region.provider)}`;
}

export function groupAndSortRegions(regions: Region[]): { name: string; message: string }[] {
  const organizationRegions = regions.filter((r) => r.organizationId !== null);
  const globalRegions = regions.filter((r) => r.organizationId === null);

  const sortedGlobalRegions = globalRegions.sort((a, b) => {
    if (a.id === 'us-east-1') return -1;
    if (b.id === 'us-east-1') return 1;
    return a.id.localeCompare(b.id);
  });

  const showGroups = organizationRegions.length > 0 && globalRegions.length > 0;

  return [
    ...organizationRegions.map((region) => ({
      name: region.id,
      message: formatRegionChoiceMessage(region, showGroups ? 'Organization' : undefined)
    })),
    ...sortedGlobalRegions.map((region) => ({
      name: region.id,
      message: formatRegionChoiceMessage(region, showGroups ? 'Global' : undefined)
    }))
  ];
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String(error.message);
  }
  return String(error);
}
