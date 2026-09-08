import type { ConsoleData, ConsoleModal, ConsoleScope, ConsoleState, PickerItem, PickerKind, ViewId } from './types';

export const VIEW_ORDER: ViewId[] = ['overview', 'branches', 'metrics', 'logs', 'insights'];

export const initialConsoleState: ConsoleState = {
  loading: true,
  activeView: 'overview'
};

export type ConsoleAction =
  | { type: 'load:start'; notice?: string }
  | { type: 'load:success'; scope: ConsoleScope; data: ConsoleData; notice?: string }
  | { type: 'load:error'; error: string }
  | { type: 'view:set'; view: ViewId }
  | { type: 'view:cycle'; delta: 1 | -1 }
  | { type: 'modal:open'; modal: ConsoleModal }
  | { type: 'modal:close' }
  | { type: 'picker:move'; delta: number; itemCount: number }
  | { type: 'notice'; notice: string }
  | { type: 'error'; error: string };

export function consoleReducer(state: ConsoleState, action: ConsoleAction): ConsoleState {
  switch (action.type) {
    case 'load:start':
      return { ...state, loading: true, modal: undefined, error: undefined, notice: action.notice };
    case 'load:success':
      return {
        ...state,
        scope: action.scope,
        data: action.data,
        loading: false,
        modal: undefined,
        error: undefined,
        notice: action.notice
      };
    case 'load:error':
      return { ...state, loading: false, modal: undefined, error: action.error, notice: undefined };
    case 'view:set':
      return { ...state, activeView: action.view, modal: undefined, error: undefined };
    case 'view:cycle': {
      const index = VIEW_ORDER.indexOf(state.activeView);
      const nextView = VIEW_ORDER[(index + action.delta + VIEW_ORDER.length) % VIEW_ORDER.length]!;
      return { ...state, activeView: nextView, modal: undefined, error: undefined };
    }
    case 'modal:open':
      return { ...state, modal: action.modal, error: undefined };
    case 'modal:close':
      return { ...state, modal: undefined };
    case 'picker:move': {
      if (state.modal?.kind !== 'picker' || action.itemCount === 0) return state;
      const highlightIndex = (state.modal.highlightIndex + action.delta + action.itemCount) % action.itemCount;
      return { ...state, modal: { ...state.modal, highlightIndex } };
    }
    case 'notice':
      return { ...state, notice: action.notice, error: undefined };
    case 'error':
      return { ...state, error: action.error, notice: undefined };
  }
}

export function getPickerItems(data: ConsoleData | undefined, picker: PickerKind): PickerItem[] {
  if (!data) return [];

  if (picker === 'organization') {
    return data.organizations.map((organization) => ({
      id: organization.id,
      label: organization.name,
      description: organization.id
    }));
  }

  if (picker === 'project') {
    return data.projects.map((project) => ({
      id: project.id,
      label: project.name,
      description: project.id
    }));
  }

  return data.branches.map((branch) => ({
    id: branch.id,
    label: branch.name,
    description: branch.id
  }));
}

export function pickBranchAfterDeletion(
  previousBranches: ConsoleData['branches'],
  deletedBranchId: string,
  remainingBranches: ConsoleData['branches']
): string | undefined {
  if (remainingBranches.length === 0) return undefined;

  const deletedIndex = previousBranches.findIndex((branch) => branch.id === deletedBranchId);
  const index = Math.max(0, Math.min(deletedIndex, remainingBranches.length - 1));
  return remainingBranches[index]?.id;
}

export function getSelectedPickerId(scope: ConsoleScope | undefined, picker: PickerKind): string | undefined {
  if (!scope) return undefined;

  if (picker === 'organization') return scope.organizationId;
  if (picker === 'project') return scope.projectId;
  return scope.kind === 'branch' ? scope.branchId : undefined;
}
