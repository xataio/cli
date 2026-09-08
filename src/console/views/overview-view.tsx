import { Box, Text } from 'ink';
import { buildBranchConnectionString } from '~/lib/branch-connection';
import { formatDate } from '../format';
import type { ConsoleData, ConsoleScope } from '../types';

export function OverviewView({ scope, data, columns }: { scope: ConsoleScope; data: ConsoleData; columns: number }) {
  if (scope.kind !== 'branch' || !data.branchDetail) {
    return (
      <Box borderStyle="round" borderColor="gray" paddingX={1} flexDirection="column" flexGrow={1}>
        <Text color="yellow">This project has no branches yet.</Text>
        <Text color="gray">Create one with `xata branch create`, then press r to refresh.</Text>
      </Box>
    );
  }

  const branch = data.branchDetail;
  const maskedConnectionString = data.branchCredentials
    ? buildBranchConnectionString(data.branchCredentials, { database: scope.database, type: scope.type, mask: true })
    : 'Unavailable';

  return (
    <Box flexDirection={columns < 100 ? 'column' : 'row'} flexGrow={1}>
      <Box borderStyle="round" borderColor="green" paddingX={1} flexDirection="column" flexGrow={1} flexBasis={0}>
        <Text bold color="green">
          branch details
        </Text>
        <DetailRow label="name" value={branch.name} />
        <DetailRow label="id" value={branch.id} />
        <DetailRow label="status" value={branch.status.status} />
        <DetailRow label="status type" value={branch.status.statusType} />
        <DetailRow label="parent" value={branch.parentID ?? '—'} />
        <DetailRow label="region" value={branch.region} />
        <DetailRow label="created" value={formatDate(branch.createdAt)} />
        <DetailRow label="updated" value={formatDate(branch.updatedAt)} />
      </Box>
      <Box borderStyle="round" borderColor="blue" paddingX={1} flexDirection="column" flexGrow={1} flexBasis={0}>
        <Text bold color="blue">
          connection
        </Text>
        <DetailRow label="database" value={scope.database} />
        <DetailRow label="type" value={scope.type} />
        <DetailRow label="instance" value={branch.configuration.instanceType} />
        <DetailRow label="replicas" value={String(branch.configuration.replicas)} />
        <DetailRow label="scale to zero" value={branch.scaleToZero.enabled ? 'enabled' : 'disabled'} />
        <DetailRow label="inactive after" value={`${branch.scaleToZero.inactivityPeriodMinutes} minutes`} />
        <Box marginTop={1} flexDirection="column">
          <Text wrap="wrap">{maskedConnectionString}</Text>
          <Text color="gray">press c to copy the full connection string</Text>
        </Box>
      </Box>
    </Box>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Box width={16}>
        <Text color="gray">{label}</Text>
      </Box>
      <Text wrap="truncate-end">{value}</Text>
    </Box>
  );
}
