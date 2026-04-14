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
          'Organization ID': projectConfig.organizationId || '(not set)',
          'Project ID': projectConfig.projectId || '(not set)',
          'Branch ID': branchConfig.branchId || '(not set)',
          'Branch Name': branchConfig.branchName || '(not set)',
          'Database Name': branchConfig.databaseName || '(not set)'
        },
        ['Configuration', 'Value'],
        [
          ['Branch ID', branchConfig.branchId || '(not set)'],
          ['Branch Name', branchConfig.branchName || '(not set)'],
          ['Database Name', branchConfig.databaseName || '(not set)'],
          ['Organization ID', projectConfig.organizationId || '(not set)'],
          ['Project ID', projectConfig.projectId || '(not set)']
        ]
      );
    }
    return false;
  }
  return true;
}
