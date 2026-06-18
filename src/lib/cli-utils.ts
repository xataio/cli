import chalk from 'chalk';
import invariant from 'tiny-invariant';
import { decodeJwt } from 'jose';
import type { LocalContext } from '~/context';
import { branchConfig } from './branch-config';
import { isCLIConfigInitialized } from './cli-config';
import { config } from './config';
import { DEFAULT_DATABASE_NAME } from './constants';
import { getProfile } from './profile';
import { projectConfig } from './project-config';
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
    invariant(false, 'expected input for flag --organization OR positional argument');
  }
  if (options.organizationName) {
    const organization = await getOrganizationByName(context, {
      organizationName: options.organizationName
    });
    return organization.id;
  }
  const title = options?.title || 'Select an organization';
  if (flags.organization) {
    return flags.organization;
  }
  if (isCLIConfigInitialized(context)) {
    return projectConfig.organizationId;
  }

  const organizationsQuery = await context.api.organizations.getOrganizationsList();
  if (organizationsQuery.organizations.length === 0) {
    invariant(false, 'no organizations found');
  }
  if (organizationsQuery.organizations.length === 1) {
    const firstOrganization = organizationsQuery.organizations?.[0];
    invariant(firstOrganization, 'organization is null');
    return firstOrganization.id;
  } else {
    const choices = organizationsQuery.organizations.map((org) => ({
      name: org.id,
      message: org.name
    }));
    const organizationId = context.enquirer.selectPrompt(context.isInteractive, title, choices);
    if (!organizationId) {
      invariant(false, 'expected input for flag --organization');
    }
    return organizationId;
  }
};

export type ProjectOptions = BaseOptions & {
  organizationId: string;
  projectName?: string;
};

export const getProject = async (context: LocalContext, flags: { project?: string }, options: ProjectOptions) => {
  if (options.projectName && flags.project) {
    invariant(false, 'expected input for flag --project OR positional argument');
  }
  if (options.projectName) {
    const project = await getProjectByName(context, {
      organizationId: options.organizationId,
      projectName: options.projectName
    });
    return project.id;
  }
  const title = options?.title || 'Select a project';
  if (flags.project) {
    return flags.project;
  }
  if (isCLIConfigInitialized(context)) {
    return projectConfig.projectId;
  }

  const projectsQuery = await context.api.projects.listProjects({
    pathParams: { organizationID: options?.organizationId }
  });
  if (projectsQuery.projects.length === 0) {
    invariant(false, 'no projects found');
  }
  if (projectsQuery.projects.length === 1) {
    const firstProject = projectsQuery.projects?.[0];
    invariant(firstProject, 'project is null');
    return firstProject.id;
  } else {
    const choices = projectsQuery.projects.map((project) => ({
      name: project.id,
      message: `${project.id} - ${project.name}`
    }));
    const projectId = context.enquirer.selectPrompt(context.isInteractive, title, choices);
    if (!projectId) {
      invariant(false, 'expected input for flag --project');
    }
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
    invariant(false, 'expected input for flag --branch OR positional argument');
  }
  if (options.branchName) {
    const branch = await getBranchByName(context, {
      organizationId: options.organizationId,
      projectId: options.projectId,
      branchName: options.branchName
    });
    return branch.id;
  }
  const title = options?.title || 'Select a branch';
  const skipProjectConfig = options?.skipProjectConfig || false;
  if (flags.branch) {
    return flags.branch;
  }
  if (!skipProjectConfig && isCLIConfigInitialized(context)) {
    return branchConfig.branchId;
  }

  const branchesQuery = await context.api.branches.listBranches({
    pathParams: { organizationID: options.organizationId, projectID: options.projectId }
  });
  if (branchesQuery.branches.length === 0) {
    context.process.stderr.write(chalk.red(`No branches found\n`));
    return '';
  }
  if (branchesQuery.branches.length === 1) {
    const firstProject = branchesQuery.branches?.[0];
    return firstProject?.id || '';
  } else {
    const choices = branchesQuery.branches.map((branch) => ({
      name: branch.id,
      message: `${branch.id} - ${branch.name}`
    }));
    const branchId = context.enquirer.selectPrompt(context.isInteractive && !skipPrompt, title, choices);
    return branchId;
  }
};

export const getCheckedOutBranch = async (context: LocalContext) => {
  if (isCLIConfigInitialized(context)) {
    return branchConfig.branchId;
  }
  return null;
};

export const getDatabase = async (context: LocalContext, flags: { database?: string }) => {
  if (flags.database) {
    return flags.database;
  }
  if (isCLIConfigInitialized(context)) {
    return branchConfig.databaseName;
  }

  const databaseName = await context.enquirer.inputPrompt(context.isInteractive, 'Please enter the database name', {
    placeholder: DEFAULT_DATABASE_NAME
  });
  return databaseName;
};

type GetBranchByNameOptions = {
  organizationId: string;
  projectId: string;
  branchName?: string;
};

async function getBranchByName(context: LocalContext, options: GetBranchByNameOptions) {
  const { organizationId, projectId, branchName } = options;
  const { branches } = await context.api.branches.listBranches({
    pathParams: { organizationID: organizationId, projectID: projectId }
  });
  const branch = branches.find((b) => b.name === branchName);
  invariant(branch, `Branch ${branchName} not found`);
  return branch;
}

type GetOrganizationByNameOptions = {
  organizationName: string;
};

async function getOrganizationByName(context: LocalContext, options: GetOrganizationByNameOptions) {
  const { organizationName } = options;
  const { organizations } = await context.api.organizations.getOrganizationsList();
  const organization = organizations.find((org) => org.name === organizationName);
  invariant(organization, `Organization ${organizationName} not found`);
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
  invariant(project, `Project ${projectName} not found`);
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
