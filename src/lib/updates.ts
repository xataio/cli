import path from 'node:path';
import { getConfigDir } from '~/lib/config';
import { version } from '../../package.json';
import { CLI_NAME } from './constants';

export const BUCKET_NAME = 'xata-cli-versions';
export const CONFIG_DIR = getConfigDir();
export const BIN_DIR = path.join(CONFIG_DIR, 'bin');
export const CLI_PATH = path.join(BIN_DIR, CLI_NAME);

export function getCLIVersion() {
  return version;
}

export async function getLatestVersion() {
  try {
    const response = await fetch(`https://${BUCKET_NAME}.s3.amazonaws.com/channels/latest/manifest.json`);
    const data = await response.json();
    return data.version;
  } catch (e) {
    if (e instanceof Error) {
      console.error('Failed to get the latest version:', e.message);
    } else {
      console.error('Failed to get the latest version:', e);
    }
    return getCLIVersion();
  }
}
