import type { LocalContext } from '~/context';
import { branchConfig, isBranchInitialized } from './branch-config';
import { isProjectInitialized, projectConfig } from './project-config';

export function isCLIConfigInitialized(context: LocalContext) {
  const isInitialized = isProjectInitialized() && isBranchInitialized();
  if (!isInitialized) {
    if (context.debug) {
      context.process.stdout.write('\nCLI Configuration Status - All values must be set for initialization:\n');
      context.print(
        context,
        false,
        {
          organization_id: projectConfig.organizationId || '(not set)',
          project_id: projectConfig.projectId || '(not set)',
          branch_id: branchConfig.branchId || '(not set)',
          branch: branchConfig.branchName || '(not set)',
          database: branchConfig.databaseName || '(not set)'
        },
        ['config', 'value'],
        [
          ['branch_id', branchConfig.branchId || '(not set)'],
          ['branch', branchConfig.branchName || '(not set)'],
          ['database', branchConfig.databaseName || '(not set)'],
          ['organization_id', projectConfig.organizationId || '(not set)'],
          ['project_id', projectConfig.projectId || '(not set)']
        ]
      );
    }
    return false;
  }
  return true;
}
