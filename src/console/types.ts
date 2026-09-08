import type { Types } from '@xata.io/api';
import type { BranchConnectionType } from '~/lib/branch-connection';

export type ConsoleFlags = {
  organization?: string;
  project?: string;
  branch?: string;
  database?: string;
  type: BranchConnectionType;
};

export type ConsoleScopeBase = {
  organizationId: string;
  projectId: string;
  database: string;
  type: BranchConnectionType;
};

export type ConsoleScope =
  | ({ kind: 'project' } & ConsoleScopeBase)
  | ({ kind: 'branch'; branchId: string } & ConsoleScopeBase);

export type ConsoleData = {
  organizations: Types.Organization[];
  projects: Types.Project[];
  branches: Types.BranchListMetadata[];
  branchDetail?: Types.BranchMetadata;
  branchCredentials?: Types.BranchCredentials;
};

export type ViewId = 'overview' | 'branches' | 'metrics' | 'logs' | 'insights';

export type PickerKind = 'organization' | 'project' | 'branch';

export type ConsoleModal =
  | { kind: 'picker'; picker: PickerKind; highlightIndex: number }
  | { kind: 'help' }
  | { kind: 'create-branch'; parentBranchId: string; parentBranchName: string }
  | { kind: 'confirm-delete'; branchId: string; branchName: string; isCurrentTarget: boolean };

export type ConsoleState = {
  scope?: ConsoleScope;
  data?: ConsoleData;
  activeView: ViewId;
  modal?: ConsoleModal;
  loading: boolean;
  notice?: string;
  error?: string;
};

export type PickerItem = {
  id: string;
  label: string;
  description?: string;
};

export type ConsoleHandoff =
  | { kind: 'psql'; connectionString: string; database: string; branchName: string }
  | {
      kind: 'scratch-psql';
      organizationId: string;
      projectId: string;
      parentBranchId: string;
      parentBranchName: string;
      database: string;
    };

export type ConsoleResume = {
  organizationId: string;
  projectId: string;
  branchId?: string;
  database: string;
  type: BranchConnectionType;
  view: ViewId;
};

export type ConsoleHandoffRequest = {
  handoff: ConsoleHandoff;
  resume: ConsoleResume;
};
