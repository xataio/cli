import { describe, expect, test } from 'bun:test';
import {
  consoleReducer,
  getPickerItems,
  getSelectedPickerId,
  initialConsoleState,
  pickBranchAfterDeletion
} from './state';
import type { ConsoleData, ConsoleScope, ConsoleState } from './types';

const scope: ConsoleScope = {
  kind: 'branch',
  organizationId: 'org-1',
  projectId: 'project-1',
  branchId: 'branch-1',
  database: 'app',
  type: 'primary'
};

const data: ConsoleData = {
  organizations: [{ id: 'org-1', name: 'Org One' }] as ConsoleData['organizations'],
  projects: [{ id: 'project-1', name: 'Project One' }] as ConsoleData['projects'],
  branches: [
    { id: 'branch-1', name: 'main' },
    { id: 'branch-2', name: 'dev' }
  ] as ConsoleData['branches'],
  branchDetail: undefined
};

function loadedState(): ConsoleState {
  return consoleReducer(initialConsoleState, { type: 'load:success', scope, data, notice: 'Ready' });
}

describe('console reducer', () => {
  test('load:success stores scope and data and closes modals', () => {
    const state = consoleReducer(
      { ...initialConsoleState, modal: { kind: 'help' } },
      { type: 'load:success', scope, data, notice: 'Ready' }
    );

    expect(state.scope).toEqual(scope);
    expect(state.data).toEqual(data);
    expect(state.loading).toBe(false);
    expect(state.modal).toBeUndefined();
    expect(state.notice).toBe('Ready');
  });

  test('load:start closes an open modal', () => {
    const state = consoleReducer(
      { ...loadedState(), modal: { kind: 'picker', picker: 'branch', highlightIndex: 1 } },
      { type: 'load:start', notice: 'Loading…' }
    );

    expect(state.loading).toBe(true);
    expect(state.modal).toBeUndefined();
  });

  test('view:set switches the active view and closes modals', () => {
    const state = consoleReducer({ ...loadedState(), modal: { kind: 'help' } }, { type: 'view:set', view: 'branches' });

    expect(state.activeView).toBe('branches');
    expect(state.modal).toBeUndefined();
  });

  test('view:cycle wraps around in both directions', () => {
    const fromOverview = consoleReducer(loadedState(), { type: 'view:cycle', delta: 1 });
    expect(fromOverview.activeView).toBe('branches');

    const fromBranches = consoleReducer(fromOverview, { type: 'view:cycle', delta: 1 });
    expect(fromBranches.activeView).toBe('metrics');

    const fromMetrics = consoleReducer(fromBranches, { type: 'view:cycle', delta: 1 });
    expect(fromMetrics.activeView).toBe('logs');

    const fromLogs = consoleReducer(fromMetrics, { type: 'view:cycle', delta: 1 });
    expect(fromLogs.activeView).toBe('insights');

    const wrapped = consoleReducer(fromLogs, { type: 'view:cycle', delta: 1 });
    expect(wrapped.activeView).toBe('overview');

    const backwards = consoleReducer(loadedState(), { type: 'view:cycle', delta: -1 });
    expect(backwards.activeView).toBe('insights');
  });

  test('picker:move wraps within item count', () => {
    const withPicker: ConsoleState = {
      ...loadedState(),
      modal: { kind: 'picker', picker: 'branch', highlightIndex: 0 }
    };

    const movedUp = consoleReducer(withPicker, { type: 'picker:move', delta: -1, itemCount: 2 });
    expect(movedUp.modal).toEqual({ kind: 'picker', picker: 'branch', highlightIndex: 1 });

    const movedDown = consoleReducer(movedUp, { type: 'picker:move', delta: 1, itemCount: 2 });
    expect(movedDown.modal).toEqual({ kind: 'picker', picker: 'branch', highlightIndex: 0 });
  });

  test('picker:move is ignored without a picker modal', () => {
    const state = loadedState();
    expect(consoleReducer(state, { type: 'picker:move', delta: 1, itemCount: 2 })).toBe(state);

    const withHelp: ConsoleState = { ...state, modal: { kind: 'help' } };
    expect(consoleReducer(withHelp, { type: 'picker:move', delta: 1, itemCount: 2 })).toBe(withHelp);
  });

  test('error clears notice and notice clears error', () => {
    const withError = consoleReducer(loadedState(), { type: 'error', error: 'Boom' });
    expect(withError.error).toBe('Boom');
    expect(withError.notice).toBeUndefined();

    const withNotice = consoleReducer(withError, { type: 'notice', notice: 'Done' });
    expect(withNotice.notice).toBe('Done');
    expect(withNotice.error).toBeUndefined();
  });
});

describe('pickBranchAfterDeletion', () => {
  const previous = [
    { id: 'branch-1', name: 'main' },
    { id: 'branch-2', name: 'dev' },
    { id: 'branch-3', name: 'feature' }
  ] as ConsoleData['branches'];

  test('returns undefined when no branches remain', () => {
    expect(pickBranchAfterDeletion(previous, 'branch-1', [] as ConsoleData['branches'])).toBeUndefined();
  });

  test('picks the branch at the deleted position', () => {
    const remaining = previous.filter((branch) => branch.id !== 'branch-2');
    expect(pickBranchAfterDeletion(previous, 'branch-2', remaining)).toBe('branch-3');
  });

  test('clamps to the last remaining branch', () => {
    const remaining = previous.filter((branch) => branch.id !== 'branch-3');
    expect(pickBranchAfterDeletion(previous, 'branch-3', remaining)).toBe('branch-2');
  });

  test('falls back to the first branch when the deleted branch is unknown', () => {
    expect(pickBranchAfterDeletion(previous, 'missing', previous)).toBe('branch-1');
  });
});

describe('picker helpers', () => {
  test('builds picker items per kind', () => {
    expect(getPickerItems(data, 'organization')).toEqual([{ id: 'org-1', label: 'Org One', description: 'org-1' }]);
    expect(getPickerItems(data, 'project')).toEqual([
      { id: 'project-1', label: 'Project One', description: 'project-1' }
    ]);
    expect(getPickerItems(data, 'branch')).toEqual([
      { id: 'branch-1', label: 'main', description: 'branch-1' },
      { id: 'branch-2', label: 'dev', description: 'branch-2' }
    ]);
    expect(getPickerItems(undefined, 'branch')).toEqual([]);
  });

  test('resolves the selected picker id from scope', () => {
    expect(getSelectedPickerId(scope, 'organization')).toBe('org-1');
    expect(getSelectedPickerId(scope, 'project')).toBe('project-1');
    expect(getSelectedPickerId(scope, 'branch')).toBe('branch-1');

    const projectScope: ConsoleScope = {
      kind: 'project',
      organizationId: 'org-1',
      projectId: 'project-1',
      database: 'app',
      type: 'primary'
    };
    expect(getSelectedPickerId(projectScope, 'branch')).toBeUndefined();
    expect(getSelectedPickerId(undefined, 'branch')).toBeUndefined();
  });
});
