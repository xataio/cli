import chalk from 'chalk';
import type { LocalContext } from '~/context';

export type TargetTuningInput = {
  ramGiB: number;
  milliVCPUs: number;
  storageGB?: number;
};

const SERVING_MAX_WAL_SIZE_GB = 4;
const MAX_WAL_SIZE_CAP_GB = 100;
const MAX_WAL_SIZE_STORAGE_SHARE = 0.15;
const MAINTENANCE_WORK_MEM_RAM_SHARE = 0.25;
const MAINTENANCE_WORK_MEM_MIN_MB = 256;
const MAINTENANCE_WORK_MEM_MAX_MB = 16 * 1024;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatMemory(megabytes: number) {
  return megabytes % 1024 === 0 ? `${megabytes / 1024}GB` : `${megabytes}MB`;
}

function wholeVCPUs(milliVCPUs: number) {
  return Math.max(1, Math.floor(milliVCPUs / 1000));
}

function parallelMaintenanceWorkers(milliVCPUs: number) {
  return clamp(wholeVCPUs(milliVCPUs), 2, 16);
}

export function buildBranchTuning({ storageGB }: TargetTuningInput) {
  const maxWalSizeGB =
    storageGB === undefined
      ? SERVING_MAX_WAL_SIZE_GB
      : clamp(Math.floor(storageGB * MAX_WAL_SIZE_STORAGE_SHARE), SERVING_MAX_WAL_SIZE_GB, MAX_WAL_SIZE_CAP_GB);

  return { max_wal_size: `${maxWalSizeGB}GB` };
}

export function buildIndexConstraintSessionSettings({ ramGiB, milliVCPUs }: TargetTuningInput) {
  const maintenanceWorkMemMB = clamp(
    Math.floor(ramGiB * 1024 * MAINTENANCE_WORK_MEM_RAM_SHARE),
    MAINTENANCE_WORK_MEM_MIN_MB,
    MAINTENANCE_WORK_MEM_MAX_MB
  );

  return [
    `maintenance_work_mem=${formatMemory(maintenanceWorkMemMB)}`,
    `max_parallel_maintenance_workers=${parallelMaintenanceWorkers(milliVCPUs)}`,
    `maintenance_io_concurrency=${wholeVCPUs(milliVCPUs) >= 8 ? 64 : 32}`
  ];
}

const READY_POLL_INTERVAL_MS = 2000;
const READY_TIMEOUT_MS = 5 * 60 * 1000;

async function waitForHealthy(
  context: LocalContext,
  pathParams: { organizationID: string; projectID: string; branchID: string }
) {
  const deadline = Date.now() + READY_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const branch = await context.api.branches.describeBranch({ pathParams });
    if (branch.status.statusType === 'STATUS_TYPE_HEALTHY') {
      return true;
    }
    context.process.stderr.write(chalk.yellow(`Waiting for branch ${branch.name} to apply the tuning...\n`));
    await new Promise((resolve) => setTimeout(resolve, READY_POLL_INTERVAL_MS));
  }

  return false;
}

function printTuningHelp(context: LocalContext, branchTuning: Record<string, string>, sessionSettings: string[]) {
  const lines = [
    chalk.bold('Target branch tuned for the load:'),
    ...Object.entries(branchTuning).map(([name, value]) => `  ${name} = ${value}`),
    '',
    chalk.bold('Applied to the index and constraint rebuild only:'),
    ...sessionSettings.map((setting) => `  ${setting.replace('=', ' = ')}`),
    '',
    'Indexes and foreign keys are rebuilt once the data lands, and these settings apply to that',
    'rebuild session alone, which is the phase they speed up.',
    '',
    'The branch configuration is reverted when this clone stops, whether it succeeds or fails.',
    ''
  ];

  context.process.stderr.write(lines.join('\n'));
}

export async function applyTargetDatabaseTuning(
  context: LocalContext,
  target: { organizationId: string; projectId: string; branchId: string }
) {
  const pathParams = { organizationID: target.organizationId, projectID: target.projectId, branchID: target.branchId };

  const branch = await context.api.branches.describeBranch({ pathParams });

  const { instanceTypes } = await context.api.projects.listInstanceTypes({
    pathParams: { organizationID: target.organizationId },
    queryParams: { region: branch.region }
  });
  const instance = instanceTypes.find((instanceType) => instanceType.name === branch.configuration.instanceType);
  if (!instance) {
    throw new Error(
      `Cannot tune the target: instance type ${branch.configuration.instanceType} is not available in region ${branch.region}.`
    );
  }

  const input = {
    ramGiB: instance.ram,
    milliVCPUs: instance.vcpus,
    storageGB: branch.configuration.storage
  };
  const branchTuning = buildBranchTuning(input);
  const sessionSettings = buildIndexConstraintSessionSettings(input);

  const servingParameters = branch.configuration.postgresConfigurationParameters ?? {};
  const tunedParameters = Object.keys(branchTuning);
  const notRevertible = tunedParameters.filter((name) => !(name in servingParameters));
  if (notRevertible.length > 0) {
    context.process.stderr.write(
      chalk.yellow(
        `Branch ${branch.name} does not set ${notRevertible.join(', ')}; these cannot be removed again and will persist after the clone.\n`
      )
    );
  }

  await context.api.branches.updateBranch({
    pathParams,
    body: { postgresConfigurationParameters: branchTuning }
  });

  if (!(await waitForHealthy(context, pathParams))) {
    context.process.stderr.write(
      chalk.yellow(`Branch ${branch.name} is still not healthy after tuning, continuing.\n`)
    );
  }

  printTuningHelp(context, branchTuning, sessionSettings);

  const previousValues = Object.fromEntries(
    tunedParameters.filter((name) => name in servingParameters).map((name) => [name, servingParameters[name] as string])
  );

  return { branchTuning, sessionSettings, pathParams, previousValues, branchName: branch.name };
}

export type TargetTuning = Awaited<ReturnType<typeof applyTargetDatabaseTuning>>;

export async function revertTargetDatabaseTuning(context: LocalContext, tuning: TargetTuning) {
  if (Object.keys(tuning.previousValues).length === 0) {
    return;
  }

  try {
    await context.api.branches.updateBranch({
      pathParams: tuning.pathParams,
      body: { postgresConfigurationParameters: tuning.previousValues }
    });
    context.process.stderr.write(chalk.green(`Reverted the tuning on branch ${tuning.branchName}.\n`));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const settings = Object.entries(tuning.previousValues)
      .map(([name, value]) => `${name}=${value}`)
      .join(', ');
    context.process.stderr.write(
      chalk.yellow(
        `Could not revert the tuning on branch ${tuning.branchName}: ${detail}\n` +
          `The branch is still tuned for a bulk load. Restore ${settings} from the console.\n`
      )
    );
  }
}
