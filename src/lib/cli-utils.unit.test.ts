import { describe, expect, it } from 'bun:test';
import { getErrorMessage, groupAndSortRegions } from './cli-utils';

type Region = {
  id: string;
  publicAccess: boolean;
  backupsEnabled: boolean;
  organizationId: string | null;
};

function createRegion(id: string, organizationId: string | null = null): Region {
  return { id, publicAccess: true, backupsEnabled: true, organizationId };
}

describe('groupAndSortRegions', () => {
  describe('with only global regions', () => {
    it('should return regions without group prefix', () => {
      const regions = [createRegion('eu-west-1'), createRegion('us-east-1')];

      const result = groupAndSortRegions(regions);

      expect(result).toEqual([
        { name: 'us-east-1', message: 'us-east-1' },
        { name: 'eu-west-1', message: 'eu-west-1' }
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

      expect(result).toEqual([
        { name: 'org-region-1', message: 'org-region-1' },
        { name: 'org-region-2', message: 'org-region-2' }
      ]);
    });
  });

  describe('with both global and organization regions', () => {
    it('should add group prefixes to messages', () => {
      const regions = [createRegion('us-east-1'), createRegion('org-region-1', 'org-123')];

      const result = groupAndSortRegions(regions);

      expect(result).toEqual([
        { name: 'org-region-1', message: '[Organization] org-region-1' },
        { name: 'us-east-1', message: '[Global] us-east-1' }
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

      expect(result).toEqual([{ name: 'us-west-2', message: 'us-west-2' }]);
    });

    it('should handle single organization region', () => {
      const regions = [createRegion('org-region-1', 'org-123')];

      const result = groupAndSortRegions(regions);

      expect(result).toEqual([{ name: 'org-region-1', message: 'org-region-1' }]);
    });
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
