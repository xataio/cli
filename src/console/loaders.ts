import type { Types } from '@xata.io/api';
import { fetchBranchCredentials } from '@xata.io/sql';
import type { LocalContext } from '~/context';
import { branchConfig } from '~/lib/branch-config';
import { DEFAULT_DATABASE_NAME } from '~/lib/constants';
import { hasProjectContext, projectConfig } from '~/lib/project-config';
import type { ConsoleData, ConsoleFlags, ConsoleScope, ConsoleScopeBase } from './types';

export async function listOrganizations(context: LocalContext) {
  const { organizations } = await context.api.organizations.getOrganizationsList({});
  return organizations;
}

export async function listProjects(context: LocalContext, organizationId: string) {
  const { projects } = await context.api.projects.listProjects({
    pathParams: { organizationID: organizationId }
  });
  return projects;
}

export async function listBranches(context: LocalContext, organizationId: string, projectId: string) {
  const { branches } = await context.api.branches.listBranches({
    pathParams: { organizationID: organizationId, projectID: projectId }
  });
  return branches;
}

export async function describeBranchWithCredentials(
  context: LocalContext,
  organizationId: string,
  projectId: string,
  branchId: string
) {
  const [branchDetail, branchCredentials] = await Promise.all([
    context.api.branches.describeBranch({
      pathParams: { organizationID: organizationId, projectID: projectId, branchID: branchId }
    }),
    fetchBranchCredentials(context.api, {
      organizationID: organizationId,
      projectID: projectId,
      branchID: branchId
    }).catch(() => undefined)
  ]);

  return { branchDetail, branchCredentials };
}

export function resolveDatabaseName(flags: Pick<ConsoleFlags, 'database'>) {
  if (flags.database) {
    return flags.database;
  }

  if (isConsoleConfigInitialized()) {
    return branchConfig.databaseName;
  }

  return DEFAULT_DATABASE_NAME;
}

export function buildScope(base: ConsoleScopeBase, branchId?: string): ConsoleScope {
  return branchId ? { kind: 'branch', ...base, branchId } : { kind: 'project', ...base };
}

export async function resolveInitialConsoleState(context: LocalContext, flags: ConsoleFlags) {
  const organizations = await listOrganizations(context);
  const organization = pickOrganization(organizations, flags.organization);
  const projects = await listProjects(context, organization.id);
  const project = pickProject(projects, flags.project);
  const branches = await listBranches(context, organization.id, project.id);
  const branch = pickBranch(branches, flags.branch);
  const branchData = branch
    ? await describeBranchWithCredentials(context, organization.id, project.id, branch.id)
    : { branchDetail: undefined, branchCredentials: undefined };

  const scope = buildScope(
    {
      organizationId: organization.id,
      projectId: project.id,
      database: resolveDatabaseName(flags),
      type: flags.type
    },
    branch?.id
  );

  const data: ConsoleData = { organizations, projects, branches, ...branchData };

  return { scope, data };
}

export async function loadAfterOrganizationChange(
  context: LocalContext,
  current: ConsoleScope,
  organizationId: string
) {
  const projects = await listProjects(context, organizationId);
  const project = pickProject(projects);
  const branches = await listBranches(context, organizationId, project.id);
  const branch = pickBranch(branches);
  const branchData = branch
    ? await describeBranchWithCredentials(context, organizationId, project.id, branch.id)
    : { branchDetail: undefined, branchCredentials: undefined };

  return {
    scope: buildScope(
      { organizationId, projectId: project.id, database: current.database, type: current.type },
      branch?.id
    ),
    projects,
    branches,
    ...branchData
  };
}

export async function loadAfterProjectChange(context: LocalContext, current: ConsoleScope, projectId: string) {
  const branches = await listBranches(context, current.organizationId, projectId);
  const branch = pickBranch(branches);
  const branchData = branch
    ? await describeBranchWithCredentials(context, current.organizationId, projectId, branch.id)
    : { branchDetail: undefined, branchCredentials: undefined };

  return {
    scope: buildScope(
      { organizationId: current.organizationId, projectId, database: current.database, type: current.type },
      branch?.id
    ),
    branches,
    ...branchData
  };
}

export async function loadAfterBranchChange(context: LocalContext, current: ConsoleScope, branchId: string) {
  const branchData = await describeBranchWithCredentials(context, current.organizationId, current.projectId, branchId);

  return {
    scope: buildScope(
      {
        organizationId: current.organizationId,
        projectId: current.projectId,
        database: current.database,
        type: current.type
      },
      branchId
    ),
    ...branchData
  };
}

export async function refreshCurrentConsoleData(context: LocalContext, scope: ConsoleScope): Promise<ConsoleData> {
  const [organizations, projects, branches, branchData] = await Promise.all([
    listOrganizations(context),
    listProjects(context, scope.organizationId),
    listBranches(context, scope.organizationId, scope.projectId),
    scope.kind === 'branch'
      ? describeBranchWithCredentials(context, scope.organizationId, scope.projectId, scope.branchId)
      : Promise.resolve({ branchDetail: undefined, branchCredentials: undefined })
  ]);

  return { organizations, projects, branches, ...branchData };
}

function pickOrganization(organizations: Types.Organization[], organizationId?: string) {
  if (organizations.length === 0) {
    throw new Error('No organizations found.');
  }

  if (organizationId) {
    const organization = organizations.find((org) => org.id === organizationId);
    if (!organization) {
      throw new Error(`Organization not found: ${organizationId}`);
    }
    return organization;
  }

  if (isConsoleConfigInitialized()) {
    const configuredOrganization = organizations.find((org) => org.id === projectConfig.organizationId);
    if (configuredOrganization) {
      return configuredOrganization;
    }
  }

  return organizations[0]!;
}

function pickProject(projects: Types.Project[], projectId?: string) {
  if (projects.length === 0) {
    throw new Error('No projects found for the selected organization.');
  }

  if (projectId) {
    const project = projects.find((item) => item.id === projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }
    return project;
  }

  if (isConsoleConfigInitialized()) {
    const configuredProject = projects.find((project) => project.id === projectConfig.projectId);
    if (configuredProject) {
      return configuredProject;
    }
  }

  return projects[0]!;
}

function pickBranch(branches: Types.BranchListMetadata[], branchId?: string): Types.BranchListMetadata | undefined {
  if (branchId) {
    const branch = branches.find((item) => item.id === branchId);
    if (!branch) {
      throw new Error(`Branch not found: ${branchId}`);
    }
    return branch;
  }

  if (isConsoleConfigInitialized()) {
    const configuredBranch = branches.find((branch) => branch.id === branchConfig.branchId);
    if (configuredBranch) {
      return configuredBranch;
    }
  }

  return branches[0];
}

function isConsoleConfigInitialized() {
  return hasProjectContext() && Boolean(branchConfig.branchId && branchConfig.branchName && branchConfig.databaseName);
}
