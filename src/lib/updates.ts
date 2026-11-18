import { version } from '../../package.json';

export const BUCKET_NAME = 'xata-cli-versions';

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
