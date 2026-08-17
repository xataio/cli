import { describe, expect, it, mock } from 'bun:test';
import { ApiError } from '@xata.io/api';
import stripAnsi from 'strip-ansi';
import type { LocalContext } from '~/context';
import { getBranch, getErrorMessage, groupAndSortRegions, print, resolveBranchIdOrName } from './cli-utils';
import { renderTable } from './table';

type Region = {
  id: string;
  publicAccess: boolean;
  backupsEnabled: boolean;
  provider: 'aws' | 'gcp' | 'custom';
  organizationId: string | null;
};

const normalizeTableOutput = (output: string) => {
  return stripAnsi(output)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/\s+/));
};

function stripMessages(choices: { name: string; message: string }[]) {
  return choices.map((choice) => ({ ...choice, message: stripAnsi(choice.message) }));
}

function createRegion(id: string, organizationId: string | null = null, provider: Region['provider'] = 'aws'): Region {
  return { id, publicAccess: true, backupsEnabled: true, provider, organizationId };
}

describe('groupAndSortRegions', () => {
  describe('with only global regions', () => {
    it('should return regions without group prefix', () => {
      const regions = [createRegion('eu-west-1'), createRegion('us-east-1')];

      const result = groupAndSortRegions(regions);

      expect(stripMessages(result)).toEqual([
        { name: 'us-east-1', message: 'us-east-1 (AWS)' },
        { name: 'eu-west-1', message: 'eu-west-1 (AWS)' }
      ]);
    });

    it('should add cloud provider labels to region messages', () => {
      const regions = [createRegion('us-east-1', null, 'aws'), createRegion('europe-west1', null, 'gcp')];

      const result = groupAndSortRegions(regions);

      expect(stripMessages(result)).toEqual([
        { name: 'us-east-1', message: 'us-east-1 (AWS)' },
        { name: 'europe-west1', message: 'europe-west1 (GCP)' }
      ]);
    });

    it('should sort us-east-1 first', () => {
      const regions = [createRegion('eu-west-1'), createRegion('ap-south-1'), createRegion('us-east-1')];

      const result = groupAndSortRegions(regions);

      expect(result[0]?.name).toBe('us-east-1');
    });

    it('should sort remaining regions alphabetically', () => {
      const regions = [createRegion('eu-west-1'), createRegion('ap-south-1'), createRegion('us-east-1')];

      const result = groupAndSortRegions(regions);

      expect(result.map((r) => r.name)).toEqual(['us-east-1', 'ap-south-1', 'eu-west-1']);
    });
  });

  describe('with only organization regions', () => {
    it('should return regions without group prefix', () => {
      const regions = [createRegion('org-region-1', 'org-123'), createRegion('org-region-2', 'org-123')];

      const result = groupAndSortRegions(regions);

      expect(stripMessages(result)).toEqual([
        { name: 'org-region-1', message: 'org-region-1 (AWS)' },
        { name: 'org-region-2', message: 'org-region-2 (AWS)' }
      ]);
    });

    it('should add custom provider labels to organization region messages', () => {
      const regions = [createRegion('org-region-1', 'org-123', 'custom')];

      const result = groupAndSortRegions(regions);

      expect(stripMessages(result)).toEqual([{ name: 'org-region-1', message: 'org-region-1 (Custom)' }]);
    });
  });

  describe('with both global and organization regions', () => {
    it('should add group prefixes to messages', () => {
      const regions = [createRegion('us-east-1'), createRegion('org-region-1', 'org-123', 'custom')];

      const result = groupAndSortRegions(regions);

      expect(stripMessages(result)).toEqual([
        { name: 'org-region-1', message: '[Organization] org-region-1 (Custom)' },
        { name: 'us-east-1', message: '[Global] us-east-1 (AWS)' }
      ]);
    });

    it('should place organization regions before global regions', () => {
      const regions = [
        createRegion('us-east-1'),
        createRegion('eu-west-1'),
        createRegion('org-region-1', 'org-123'),
        createRegion('org-region-2', 'org-456')
      ];

      const result = groupAndSortRegions(regions);

      expect(result[0]?.message).toContain('[Organization]');
      expect(result[1]?.message).toContain('[Organization]');
      expect(result[2]?.message).toContain('[Global]');
      expect(result[3]?.message).toContain('[Global]');
    });

    it('should sort global regions with us-east-1 first', () => {
      const regions = [createRegion('eu-west-1'), createRegion('us-east-1'), createRegion('org-region-1', 'org-123')];

      const result = groupAndSortRegions(regions);

      const globalRegions = result.filter((r) => r.message.includes('[Global]'));
      expect(globalRegions[0]?.name).toBe('us-east-1');
      expect(globalRegions[1]?.name).toBe('eu-west-1');
    });
  });

  describe('edge cases', () => {
    it('should handle empty array', () => {
      const result = groupAndSortRegions([]);

      expect(result).toEqual([]);
    });

    it('should handle single global region', () => {
      const regions = [createRegion('us-west-2')];

      const result = groupAndSortRegions(regions);

      expect(stripMessages(result)).toEqual([{ name: 'us-west-2', message: 'us-west-2 (AWS)' }]);
    });

    it('should handle single organization region', () => {
      const regions = [createRegion('org-region-1', 'org-123')];

      const result = groupAndSortRegions(regions);

      expect(stripMessages(result)).toEqual([{ name: 'org-region-1', message: 'org-region-1 (AWS)' }]);
    });
  });
});

const BRANCH_ID = 'oansf546nh1bf3blhj75d674gs';

const branchLookupOptions = { organizationId: 'org-id', projectId: 'project-id' };

function branchNotFound() {
  return new ApiError(404, { message: 'not found' }, `Branch with ID [${BRANCH_ID}]: not found`);
}

function buildBranchContext({
  describeBranch = async () => {
    throw branchNotFound();
  },
  branches = []
}: {
  describeBranch?: () => Promise<{ id: string }>;
  branches?: { id: string; name: string }[];
} = {}) {
  const describeBranchMock = mock(describeBranch);
  const listBranches = mock(async () => ({ branches }));
  const stderr: string[] = [];
  const exit = mock((code?: number) => {
    throw new Error(`exit:${code}`);
  });

  const context = {
    api: { branches: { describeBranch: describeBranchMock, listBranches } },
    process: { stderr: { write: (value: string) => stderr.push(value) }, exit },
    isInteractive: false
  } as unknown as LocalContext;

  return { context, describeBranch: describeBranchMock, listBranches, stderr, exit };
}

describe('resolveBranchIdOrName', () => {
  it('should resolve a branch ID without listing the branches', async () => {
    const { context, describeBranch, listBranches } = buildBranchContext({
      describeBranch: async () => ({ id: BRANCH_ID })
    });

    expect(await resolveBranchIdOrName(context, BRANCH_ID, branchLookupOptions)).toBe(BRANCH_ID);
    expect(describeBranch).toHaveBeenCalledTimes(1);
    expect(listBranches).not.toHaveBeenCalled();
  });

  it('should resolve a branch name without describing it as an ID', async () => {
    const { context, describeBranch, listBranches } = buildBranchContext({
      branches: [
        { id: 'other-branch-id', name: 'staging' },
        { id: BRANCH_ID, name: 'main' }
      ]
    });

    expect(await resolveBranchIdOrName(context, 'main', branchLookupOptions)).toBe(BRANCH_ID);
    expect(listBranches).toHaveBeenCalledTimes(1);
    expect(describeBranch).not.toHaveBeenCalled();
  });

  it('should fall back to the name when a value shaped like an ID is not one', async () => {
    const { context, describeBranch, listBranches } = buildBranchContext({
      branches: [{ id: 'other-branch-id', name: BRANCH_ID }]
    });

    expect(await resolveBranchIdOrName(context, BRANCH_ID, branchLookupOptions)).toBe('other-branch-id');
    expect(describeBranch).toHaveBeenCalledTimes(1);
    expect(listBranches).toHaveBeenCalledTimes(1);
  });

  it('should fall back to the ID when a value not shaped like one still describes', async () => {
    const { context, describeBranch, listBranches } = buildBranchContext({
      describeBranch: async () => ({ id: '0ansf546nh1bf3blhj75d674gs' }),
      branches: [{ id: BRANCH_ID, name: 'main' }]
    });

    expect(await resolveBranchIdOrName(context, '0ansf546nh1bf3blhj75d674gs', branchLookupOptions)).toBe(
      '0ansf546nh1bf3blhj75d674gs'
    );
    expect(listBranches).toHaveBeenCalledTimes(1);
    expect(describeBranch).toHaveBeenCalledTimes(1);
  });

  it('should return undefined when neither the ID nor the name matches', async () => {
    const { context } = buildBranchContext({ branches: [{ id: BRANCH_ID, name: 'main' }] });

    expect(await resolveBranchIdOrName(context, 'nope', branchLookupOptions)).toBeUndefined();
  });

  it('should rethrow an API failure that is not a 404', async () => {
    const { context, listBranches } = buildBranchContext({
      describeBranch: async () => {
        throw new ApiError(500, undefined, 'Internal server error');
      },
      branches: [{ id: BRANCH_ID, name: 'main' }]
    });

    await expect(resolveBranchIdOrName(context, BRANCH_ID, branchLookupOptions)).rejects.toThrow(
      'Internal server error'
    );
    expect(listBranches).not.toHaveBeenCalled();
  });
});

describe('getBranch', () => {
  it('should resolve a branch name passed to the --branch flag', async () => {
    const { context, describeBranch } = buildBranchContext({
      branches: [{ id: BRANCH_ID, name: 'main' }]
    });

    expect(await getBranch(context, { branch: 'main' }, branchLookupOptions)).toBe(BRANCH_ID);
    expect(describeBranch).not.toHaveBeenCalled();
  });

  it('should resolve a branch ID passed to the --branch flag', async () => {
    const { context, listBranches } = buildBranchContext({
      describeBranch: async () => ({ id: BRANCH_ID })
    });

    expect(await getBranch(context, { branch: BRANCH_ID }, branchLookupOptions)).toBe(BRANCH_ID);
    expect(listBranches).not.toHaveBeenCalled();
  });

  it('should resolve a branch ID passed as the positional argument', async () => {
    const { context, listBranches } = buildBranchContext({
      describeBranch: async () => ({ id: BRANCH_ID })
    });

    expect(await getBranch(context, {}, { ...branchLookupOptions, branchName: BRANCH_ID })).toBe(BRANCH_ID);
    expect(listBranches).not.toHaveBeenCalled();
  });

  it('should report a branch passed to the --branch flag that does not exist', async () => {
    const { context, stderr, exit } = buildBranchContext({ branches: [{ id: BRANCH_ID, name: 'main' }] });

    await expect(getBranch(context, { branch: 'nope' }, branchLookupOptions)).rejects.toThrow('exit:1');
    expect(exit).toHaveBeenCalledWith(1);
    expect(stripAnsi(stderr.join(''))).toContain(
      'Invalid branch: nope. No branch in this project has that ID or name.'
    );
  });
});

describe('getErrorMessage', () => {
  it('should extract message from Error instance', () => {
    const error = new Error('Something went wrong');
    expect(getErrorMessage(error)).toBe('Something went wrong');
  });

  it('should extract message from object with message property', () => {
    const error = { message: 'API error occurred' };
    expect(getErrorMessage(error)).toBe('API error occurred');
  });

  it('should handle object with non-string message property', () => {
    const error = { message: 123 };
    expect(getErrorMessage(error)).toBe('123');
  });

  it('should convert string to itself', () => {
    expect(getErrorMessage('plain string error')).toBe('plain string error');
  });

  it('should convert number to string', () => {
    expect(getErrorMessage(404)).toBe('404');
  });

  it('should handle null', () => {
    expect(getErrorMessage(null)).toBe('null');
  });

  it('should handle undefined', () => {
    expect(getErrorMessage(undefined)).toBe('undefined');
  });

  it('should handle object without message property', () => {
    const error = { code: 'ERR_001', detail: 'some detail' };
    expect(getErrorMessage(error)).toBe('[object Object]');
  });
});

describe('print', () => {
  it('should print JSON output unchanged by table headers', () => {
    const writes: string[] = [];
    const context = {
      process: {
        stdout: {
          write: (value: string) => writes.push(value)
        }
      }
    };
    const data = { id: 'branch-id', name: 'main' };

    const result = print(context as any, true, data, ['branch_id', 'name'], [['ignored', 'ignored']]);

    expect(result).toBe(JSON.stringify(data, null, 2));
    expect(writes).toEqual([`${JSON.stringify(data, null, 2)}\n`]);
  });

  it('should print compact borderless tables', () => {
    const writes: string[] = [];
    const context = {
      process: {
        stdout: {
          write: (value: string) => writes.push(value)
        }
      }
    };

    const result = print(
      context as any,
      false,
      [
        { name: 'alpha', status: 'ready' },
        { name: 'beta', status: 'paused' }
      ],
      ['name', 'status'],
      [
        ['alpha', 'ready'],
        ['beta', 'paused']
      ]
    );

    expect(writes).toEqual([`${result}\n`]);
    expect(normalizeTableOutput(result)).toEqual([
      ['name', 'status'],
      ['alpha', 'ready'],
      ['beta', 'paused']
    ]);
  });
});

describe('renderTable', () => {
  it('should render compact borderless tables', () => {
    const result = renderTable(
      ['name', 'status'],
      [
        ['alpha', 'ready'],
        ['beta', 'paused']
      ]
    );

    expect(normalizeTableOutput(result)).toEqual([
      ['name', 'status'],
      ['alpha', 'ready'],
      ['beta', 'paused']
    ]);
  });
});
