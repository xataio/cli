import type { Types } from '@xata.io/api';
import { buildCredentialsConnectionString } from '@xata.io/sql';
import clipboard from 'clipboardy';
import { Box, Text, useApp, useInput } from 'ink';
import { useEffect, useMemo, useReducer } from 'react';
import type { LocalContext } from '~/context';
import {
  createChildBranch,
  deleteBranchById,
  getBranchDeletionBlocker,
  getChildBranchDefaults
} from '~/lib/branch-actions';
import {
  buildBranchConnectionString,
  getBranchUrlReadinessError,
  getReplicaConnectionWarning
} from '~/lib/branch-connection';
import { getErrorMessage } from '~/lib/cli-utils';
import { ConfirmModal } from './components/confirm-modal';
import { CreateBranchModal } from './components/create-branch-modal';
import { Header } from './components/header';
import { HelpModal } from './components/help-modal';
import { PickerModal } from './components/picker-modal';
import { StatusBar } from './components/status-bar';
import { ViewTabs } from './components/view-tabs';
import { useTerminalSize } from './hooks/use-terminal-size';
import {
  buildScope,
  describeBranchWithCredentials,
  listBranches,
  loadAfterBranchChange,
  loadAfterOrganizationChange,
  loadAfterProjectChange,
  refreshCurrentConsoleData,
  resolveInitialConsoleState
} from './loaders';
import {
  consoleReducer,
  getPickerItems,
  getSelectedPickerId,
  initialConsoleState,
  pickBranchAfterDeletion
} from './state';
import { resolveExecutable } from '~/lib/scratch-session';
import { QUERY_INSIGHTS_ADMIN_DATABASE } from '~/lib/query-insights';
import type { ConsoleFlags, ConsoleHandoffRequest, PickerKind, ViewId } from './types';
import { BranchesView } from './views/branches-view';
import { InsightsView } from './views/insights-view';
import { LogsView } from './views/logs-view';
import { MetricsView } from './views/metrics-view';
import { OverviewView } from './views/overview-view';

type ConsoleAppProps = {
  context: LocalContext;
  flags: ConsoleFlags;
  initialView?: ViewId;
  onHandoff?: (request: ConsoleHandoffRequest) => void;
};

export function ConsoleApp({ context, flags, initialView, onHandoff }: ConsoleAppProps) {
  const [state, dispatch] = useReducer(consoleReducer, {
    ...initialConsoleState,
    activeView: initialView ?? initialConsoleState.activeView
  });
  const { exit } = useApp();
  const size = useTerminalSize(context.process.stdout);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      dispatch({ type: 'load:start', notice: 'Loading console…' });
      try {
        const result = await resolveInitialConsoleState(context, flags);
        if (!cancelled) {
          dispatch({ type: 'load:success', ...result, notice: 'Ready' });
        }
      } catch (error) {
        if (!cancelled) {
          dispatch({ type: 'load:error', error: getErrorMessage(error) });
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [context, flags]);

  const pickerItems = useMemo(
    () => (state.modal?.kind === 'picker' ? getPickerItems(state.data, state.modal.picker) : []),
    [state.data, state.modal]
  );

  const metricsInstances = useMemo(
    () =>
      state.data?.branchDetail?.status.instances.map((instance) => ({
        id: instance.id,
        primary: instance.primary
      })) ?? [],
    [state.data?.branchDetail]
  );

  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      exit();
      return;
    }

    if (state.loading) {
      return;
    }

    if (state.modal?.kind === 'create-branch' || state.modal?.kind === 'confirm-delete') {
      return;
    }

    if (state.modal?.kind === 'help') {
      if (key.escape || input === 'q' || input === '?') {
        dispatch({ type: 'modal:close' });
      }
      return;
    }

    if (state.modal?.kind === 'picker') {
      if (key.escape) {
        dispatch({ type: 'modal:close' });
        return;
      }
      if (key.upArrow || input === 'k') {
        dispatch({ type: 'picker:move', delta: -1, itemCount: pickerItems.length });
        return;
      }
      if (key.downArrow || input === 'j') {
        dispatch({ type: 'picker:move', delta: 1, itemCount: pickerItems.length });
        return;
      }
      if (key.return) {
        const selectedItem = pickerItems[state.modal.highlightIndex];
        if (selectedItem) {
          void selectPickerItem(state.modal.picker, selectedItem.id);
        }
      }
      return;
    }

    if (input === 'q') {
      exit();
      return;
    }
    if (input === '?') {
      dispatch({ type: 'modal:open', modal: { kind: 'help' } });
      return;
    }
    if (input === 'o') {
      openPicker('organization');
      return;
    }
    if (input === 'p') {
      openPicker('project');
      return;
    }
    if (input === 'b') {
      openPicker('branch');
      return;
    }
    if (input === 'r') {
      void refresh();
      return;
    }
    if (input === '1') {
      dispatch({ type: 'view:set', view: 'overview' });
      return;
    }
    if (input === '2') {
      dispatch({ type: 'view:set', view: 'branches' });
      return;
    }
    if (input === '3') {
      dispatch({ type: 'view:set', view: 'metrics' });
      return;
    }
    if (input === '4') {
      dispatch({ type: 'view:set', view: 'logs' });
      return;
    }
    if (input === '5') {
      dispatch({ type: 'view:set', view: 'insights' });
      return;
    }
    if (key.tab) {
      dispatch({ type: 'view:cycle', delta: key.shift ? -1 : 1 });
      return;
    }
    if (input === 'c') {
      void copyConnectionString();
      return;
    }
    if (input === 'x' || input === 'X') {
      requestPsqlHandoff(input === 'X');
    }
  });

  async function refresh() {
    if (!state.scope) return;
    const scope = state.scope;

    dispatch({ type: 'load:start', notice: 'Refreshing…' });
    try {
      const data = await refreshCurrentConsoleData(context, scope);
      dispatch({ type: 'load:success', scope, data, notice: 'Refreshed' });
    } catch (error) {
      dispatch({ type: 'load:error', error: getErrorMessage(error) });
    }
  }

  function openPicker(picker: PickerKind) {
    const items = getPickerItems(state.data, picker);
    const selectedId = getSelectedPickerId(state.scope, picker);
    const highlightIndex = Math.max(
      0,
      items.findIndex((item) => item.id === selectedId)
    );
    dispatch({ type: 'modal:open', modal: { kind: 'picker', picker, highlightIndex } });
  }

  async function selectPickerItem(picker: PickerKind, id: string) {
    if (!state.scope || !state.data) return;

    dispatch({ type: 'load:start', notice: 'Loading selection…' });
    try {
      if (picker === 'organization') {
        const result = await loadAfterOrganizationChange(context, state.scope, id);
        dispatch({
          type: 'load:success',
          scope: result.scope,
          data: {
            organizations: state.data.organizations,
            projects: result.projects,
            branches: result.branches,
            branchDetail: result.branchDetail,
            branchCredentials: result.branchCredentials
          },
          notice: 'Organization changed'
        });
        return;
      }

      if (picker === 'project') {
        const result = await loadAfterProjectChange(context, state.scope, id);
        dispatch({
          type: 'load:success',
          scope: result.scope,
          data: {
            ...state.data,
            branches: result.branches,
            branchDetail: result.branchDetail,
            branchCredentials: result.branchCredentials
          },
          notice: 'Project changed'
        });
        return;
      }

      await selectBranch(id);
    } catch (error) {
      dispatch({ type: 'load:error', error: getErrorMessage(error) });
    }
  }

  async function selectBranch(branchId: string) {
    if (!state.scope || !state.data) return;

    dispatch({ type: 'load:start', notice: 'Loading branch…' });
    try {
      const result = await loadAfterBranchChange(context, state.scope, branchId);
      dispatch({
        type: 'load:success',
        scope: result.scope,
        data: {
          ...state.data,
          branchDetail: result.branchDetail,
          branchCredentials: result.branchCredentials
        },
        notice: 'Branch changed'
      });
    } catch (error) {
      dispatch({ type: 'load:error', error: getErrorMessage(error) });
    }
  }

  function requestCreateBranch(parent?: Types.BranchListMetadata) {
    if (!parent) {
      dispatch({
        type: 'error',
        error: 'This project has no branches yet. Create the first branch with `xata branch create`.'
      });
      return;
    }
    dispatch({
      type: 'modal:open',
      modal: { kind: 'create-branch', parentBranchId: parent.id, parentBranchName: parent.name }
    });
  }

  async function requestDeleteBranch(branch: Types.BranchListMetadata) {
    const checkedOutBranchId = await context.getCheckedOutBranch();
    const blocker = getBranchDeletionBlocker(branch.id, checkedOutBranchId);
    if (blocker) {
      dispatch({ type: 'error', error: blocker });
      return;
    }

    dispatch({
      type: 'modal:open',
      modal: {
        kind: 'confirm-delete',
        branchId: branch.id,
        branchName: branch.name,
        isCurrentTarget: state.scope?.kind === 'branch' && state.scope.branchId === branch.id
      }
    });
  }

  async function createBranch(parentBranchId: string, name: string) {
    if (!state.scope || !state.data) return;
    const scope = state.scope;

    dispatch({ type: 'load:start', notice: `Creating branch ${name}…` });
    try {
      const defaults = await getChildBranchDefaults(context, scope.organizationId, scope.projectId);
      const branch = await createChildBranch(context, {
        organizationId: scope.organizationId,
        projectId: scope.projectId,
        parentBranch: parentBranchId,
        name,
        scaleToZero: defaults.scaleToZero,
        inactivityPeriodMinutes: defaults.inactivityPeriodMinutes
      });
      const [branches, branchData] = await Promise.all([
        listBranches(context, scope.organizationId, scope.projectId),
        describeBranchWithCredentials(context, scope.organizationId, scope.projectId, branch.id)
      ]);
      dispatch({
        type: 'load:success',
        scope: buildScope(
          {
            organizationId: scope.organizationId,
            projectId: scope.projectId,
            database: scope.database,
            type: scope.type
          },
          branch.id
        ),
        data: { ...state.data, branches, ...branchData },
        notice: `Created branch ${branch.name}`
      });
    } catch (error) {
      dispatch({ type: 'load:error', error: getErrorMessage(error) });
    }
  }

  async function deleteBranch(branchId: string, branchName: string) {
    if (!state.scope || !state.data) return;
    const scope = state.scope;
    const previousBranches = state.data.branches;

    dispatch({ type: 'load:start', notice: `Deleting branch ${branchName}…` });
    try {
      await deleteBranchById(context, scope.organizationId, scope.projectId, branchId);
      const branches = await listBranches(context, scope.organizationId, scope.projectId);
      const previousBranchId = scope.kind === 'branch' ? scope.branchId : undefined;
      const nextBranchId =
        previousBranchId === branchId
          ? pickBranchAfterDeletion(previousBranches, branchId, branches)
          : previousBranchId;
      const branchData = nextBranchId
        ? await describeBranchWithCredentials(context, scope.organizationId, scope.projectId, nextBranchId)
        : { branchDetail: undefined, branchCredentials: undefined };
      dispatch({
        type: 'load:success',
        scope: buildScope(
          {
            organizationId: scope.organizationId,
            projectId: scope.projectId,
            database: scope.database,
            type: scope.type
          },
          nextBranchId
        ),
        data: { ...state.data, branches, ...branchData },
        notice: `Deleted branch ${branchName}`
      });
    } catch (error) {
      dispatch({ type: 'load:error', error: getErrorMessage(error) });
    }
  }

  function requestPsqlHandoff(scratch: boolean) {
    if (!onHandoff) return;

    if (state.scope?.kind !== 'branch' || !state.data?.branchDetail) {
      dispatch({ type: 'error', error: 'No branch selected. Pick a branch with b first.' });
      return;
    }

    const scope = state.scope;
    const branchDetail = state.data.branchDetail;
    const branchCredentials = state.data.branchCredentials;
    const readinessError = getBranchUrlReadinessError(branchDetail);
    if (readinessError) {
      dispatch({ type: 'error', error: readinessError });
      return;
    }
    if (!branchCredentials) {
      dispatch({
        type: 'error',
        error: `Credentials unavailable for branch ${branchDetail.name}. Ensure the API key has credentials:read and refresh with r.`
      });
      return;
    }
    if (!resolveExecutable(context, 'psql')) {
      dispatch({ type: 'error', error: 'psql not found in PATH. Install the PostgreSQL client tools first.' });
      return;
    }

    const resume = {
      organizationId: scope.organizationId,
      projectId: scope.projectId,
      branchId: scope.branchId,
      database: scope.database,
      type: scope.type,
      view: state.activeView
    };

    if (scratch) {
      onHandoff({
        handoff: {
          kind: 'scratch-psql',
          organizationId: scope.organizationId,
          projectId: scope.projectId,
          parentBranchId: scope.branchId,
          parentBranchName: branchDetail.name,
          database: scope.database
        },
        resume
      });
    } else {
      onHandoff({
        handoff: {
          kind: 'psql',
          connectionString: buildBranchConnectionString(branchCredentials, {
            database: scope.database,
            type: scope.type
          }),
          database: scope.database,
          branchName: branchDetail.name
        },
        resume
      });
    }

    exit();
  }

  async function copyConnectionString() {
    if (state.scope?.kind !== 'branch' || !state.data?.branchDetail) {
      dispatch({ type: 'error', error: 'No branch selected. Pick a branch with b first.' });
      return;
    }

    const branchDetail = state.data.branchDetail;
    const branchCredentials = state.data.branchCredentials;
    const readinessError = getBranchUrlReadinessError(branchDetail);
    if (readinessError) {
      dispatch({ type: 'error', error: readinessError });
      return;
    }
    if (!branchCredentials) {
      dispatch({
        type: 'error',
        error: `Credentials unavailable for branch ${branchDetail.name}. Ensure the API key has credentials:read and refresh with r.`
      });
      return;
    }

    try {
      dispatch({ type: 'notice', notice: 'Copying connection string…' });
      const connectionString = buildBranchConnectionString(branchCredentials, {
        database: state.scope.database,
        type: state.scope.type
      });
      await writeClipboardWithTimeout(connectionString);

      const warning = getReplicaConnectionWarning(state.scope.type, branchDetail);
      const copiedMessage = `Copied ${state.scope.type} connection string for ${state.scope.database}`;
      dispatch({
        type: 'notice',
        notice: warning ? `${copiedMessage}. ${warning}` : copiedMessage
      });
    } catch (error) {
      dispatch({
        type: 'error',
        error: `${getErrorMessage(error)}. Fallback: run xata branch url --organization ${state.scope.organizationId} --project ${state.scope.projectId} --branch ${state.scope.branchId}`
      });
    }
  }

  const viewInputActive = !state.modal && !state.loading;

  return (
    <Box flexDirection="column" paddingX={1} height={size.rows - 1}>
      <Header state={state} />
      <ViewTabs activeView={state.activeView} />
      <Box flexGrow={1} flexShrink={1} flexBasis={0} flexDirection="column" overflow="hidden">
        {renderContent()}
      </Box>
      <StatusBar state={state} />
    </Box>
  );

  function renderContent() {
    if (state.modal?.kind === 'picker') {
      return <PickerModal picker={state.modal.picker} items={pickerItems} index={state.modal.highlightIndex} />;
    }

    if (state.modal?.kind === 'help') {
      return <HelpModal activeView={state.activeView} />;
    }

    if (state.modal?.kind === 'create-branch') {
      const modal = state.modal;
      return (
        <CreateBranchModal
          parentBranchName={modal.parentBranchName}
          isActive={!state.loading}
          onSubmit={(name) => void createBranch(modal.parentBranchId, name)}
          onCancel={() => dispatch({ type: 'modal:close' })}
        />
      );
    }

    if (state.modal?.kind === 'confirm-delete') {
      const modal = state.modal;
      return (
        <ConfirmModal
          title="Delete branch"
          lines={[`name: ${modal.branchName}`, `id: ${modal.branchId}`]}
          warning={
            modal.isCurrentTarget
              ? 'This is the current target branch. The console will switch to another branch.'
              : undefined
          }
          isActive={!state.loading}
          onConfirm={() => void deleteBranch(modal.branchId, modal.branchName)}
          onCancel={() => dispatch({ type: 'modal:close' })}
        />
      );
    }

    if (state.loading && !state.data) {
      return <Text color="yellow">Loading Xata console…</Text>;
    }

    if (!state.data || !state.scope) {
      return <Text color="red">Unable to load console data.</Text>;
    }

    if (state.activeView === 'logs') {
      if (state.scope.kind !== 'branch') {
        return (
          <Box borderStyle="round" borderColor="gray" paddingX={1} flexDirection="column" flexGrow={1}>
            <Text color="yellow">No branch selected.</Text>
            <Text color="gray">Pick a branch with b to view logs.</Text>
          </Box>
        );
      }
      return (
        <LogsView
          key={`${state.scope.organizationId}:${state.scope.projectId}:${state.scope.branchId}`}
          context={context}
          organizationId={state.scope.organizationId}
          projectId={state.scope.projectId}
          branchId={state.scope.branchId}
          isActive={viewInputActive}
          rows={size.rows}
        />
      );
    }

    if (state.activeView === 'insights') {
      if (state.scope.kind !== 'branch' || !state.data.branchDetail) {
        return (
          <Box borderStyle="round" borderColor="gray" paddingX={1} flexDirection="column" flexGrow={1}>
            <Text color="yellow">No branch selected.</Text>
            <Text color="gray">Pick a branch with b to view query insights.</Text>
          </Box>
        );
      }
      const branchDetail = state.data.branchDetail;
      if (branchDetail.status.statusType !== 'STATUS_TYPE_HEALTHY') {
        return (
          <Box borderStyle="round" borderColor="gray" paddingX={1} flexDirection="column" flexGrow={1}>
            <Text color="yellow">Branch {branchDetail.name} is not ready for query insights.</Text>
            <Text color="gray">
              Wake it with `xata branch wait-ready {branchDetail.name} --wake` and refresh with r.
            </Text>
          </Box>
        );
      }
      if (!state.data.branchCredentials) {
        return (
          <Box borderStyle="round" borderColor="gray" paddingX={1} flexDirection="column" flexGrow={1}>
            <Text color="yellow">Credentials unavailable for branch {branchDetail.name}.</Text>
            <Text color="gray">Ensure the API key has credentials:read, then refresh with r.</Text>
          </Box>
        );
      }
      return (
        <InsightsView
          key={`${state.scope.organizationId}:${state.scope.projectId}:${state.scope.branchId}`}
          context={context}
          connectionString={buildCredentialsConnectionString(state.data.branchCredentials, {
            database: QUERY_INSIGHTS_ADMIN_DATABASE,
            endpointType: 'rw'
          })}
          branchName={branchDetail.name}
          isActive={viewInputActive}
          rows={size.rows}
          columns={size.columns}
        />
      );
    }

    if (state.activeView === 'metrics') {
      if (state.scope.kind !== 'branch' || !state.data.branchDetail) {
        return (
          <Box borderStyle="round" borderColor="gray" paddingX={1} flexDirection="column" flexGrow={1}>
            <Text color="yellow">No branch selected.</Text>
            <Text color="gray">Pick a branch with b to view metrics.</Text>
          </Box>
        );
      }
      return (
        <MetricsView
          key={`${state.scope.organizationId}:${state.scope.projectId}:${state.scope.branchId}`}
          context={context}
          organizationId={state.scope.organizationId}
          projectId={state.scope.projectId}
          branchId={state.scope.branchId}
          branchName={state.data.branchDetail.name}
          instances={metricsInstances}
          isActive={viewInputActive}
          rows={size.rows}
        />
      );
    }

    if (state.activeView === 'branches') {
      return (
        <BranchesView
          key={`${state.scope.organizationId}:${state.scope.projectId}`}
          branches={state.data.branches}
          currentBranchId={state.scope.kind === 'branch' ? state.scope.branchId : undefined}
          isActive={viewInputActive}
          rows={size.rows}
          onSelect={(branchId) => void selectBranch(branchId)}
          onCreate={requestCreateBranch}
          onDelete={(branch) => void requestDeleteBranch(branch)}
        />
      );
    }

    return <OverviewView scope={state.scope} data={state.data} columns={size.columns} />;
  }
}

async function writeClipboardWithTimeout(value: string) {
  let timeout: NodeJS.Timeout | undefined;

  try {
    await Promise.race([
      clipboard.write(value),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('Timed out copying to clipboard')), 3000);
      })
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}
