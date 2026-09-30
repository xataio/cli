import { DEFAULT_API_BASE_URL } from './constants';
import type { CustomConfig } from './schemas';

export const parseConsoleUrl = (value: string) => {
  if (!URL.canParse(value)) return undefined;
  const { protocol, hostname, origin } = new URL(value);
  const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(hostname);
  return protocol === 'https:' || (protocol === 'http:' && isLocal) ? origin : undefined;
};

export const resolveConsoleUrl = (envConsoleUrl: string | undefined, customConfig: CustomConfig | undefined) => {
  const fromEnv = envConsoleUrl?.trim();
  const value = fromEnv || customConfig?.consoleUrl?.trim();
  if (!value) {
    // Only the production API has a known console; any other deployment has to name its own.
    const apiBaseUrl = customConfig?.apiBaseUrl?.replace(/\/+$/, '');
    if (!apiBaseUrl || apiBaseUrl === DEFAULT_API_BASE_URL) return 'https://console.xata.io';
    throw new Error(
      'This profile uses a custom Xata API. Log in again with `xata auth login --console-url <url>` or set XATA_CONSOLE_URL.'
    );
  }
  const consoleUrl = parseConsoleUrl(value);
  if (!consoleUrl) {
    throw new Error(`${fromEnv ? 'XATA_CONSOLE_URL' : 'The console URL'} must use HTTPS (or HTTP on localhost).`);
  }
  return consoleUrl;
};
