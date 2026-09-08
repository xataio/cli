import { describe, expect, test } from 'bun:test';
import { runCli } from './cli-driver';

describe('CLI binary smoke tests', () => {
  test('--version returns version number', async () => {
    const result = await runCli(['--version']);

    expect(result.code).toBe(0);
    expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
  });

  test('--help shows available commands', async () => {
    const result = await runCli(['--help']);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('xata');
    expect(result.stdout).toMatch(/branch|project|organization/i);
    expect(result.stdout).not.toContain('console');
  });

  test('hidden console command still exposes its help', async () => {
    const result = await runCli(['console', '--help']);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('Open an interactive branch console');
  });

  test('console requires an interactive terminal', async () => {
    const result = await runCli(['console']);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('requires an interactive terminal');
  });

  test('scratch help shows conventional command forwarding', async () => {
    const result = await runCli(['scratch', '--help']);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('-- psql -c "select count(*) from users"');
  });

  test('scratch accepts child flags after the argument delimiter', async () => {
    const result = await runCli(['scratch', '--', 'definitely-missing-xata-scratch-binary', '-c', 'select 1']);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('Executable not found: definitely-missing-xata-scratch-binary');
    expect(result.stderr).not.toContain('No alias registered for -c');
  });

  test('status command works when not initialized', async () => {
    const result = await runCli(['status']);

    expect(result.code).toBe(0);
    expect(result.stdout + result.stderr).toMatch(/project|config/i);
  });

  test('version --json returns valid JSON', async () => {
    const result = await runCli(['version', '--json', '--skip-download']);

    expect(result.code).toBe(0);

    const parsed = JSON.parse(result.stdout);
    expect(parsed).toHaveProperty('CLIVersion');
    expect(typeof parsed.CLIVersion).toBe('string');
  });
});
