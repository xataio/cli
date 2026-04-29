import * as chrono from 'chrono-node';
import { datePrompt, selectPrompt } from './enquirer';

export async function parseExpiry(isInteractive: boolean, expiryFlag = ''): Promise<string | null> {
  if (expiryFlag === 'never' || expiryFlag === 'null') {
    return null;
  }

  const parsedFlag = chrono.parseDate(expiryFlag);
  if (expiryFlag && isValidDate(parsedFlag)) {
    return parsedFlag?.toISOString() || null;
  } else if (expiryFlag) {
    throw new Error(`Unable to parse expiry date: ${expiryFlag}`);
  }

  const choice = await selectPrompt(
    isInteractive,
    'Select expiry',
    [
      { name: 'never', message: 'Never' },
      { name: 'In 1 day', message: 'In 1 day' },
      { name: 'In 1 week', message: 'In 1 week' },
      { name: 'In 1 month', message: 'In 1 month' },
      { name: 'In 1 year', message: 'In 1 year' },
      { name: 'custom', message: 'Custom' }
    ],
    { flag: expiryFlag }
  );

  if (choice === 'never') {
    return null;
  }

  if (choice === 'custom') {
    const date = await datePrompt(isInteractive, 'Enter expiry (e.g. "In 1 week" or "2025-12-31")');
    return date?.toISOString() || null;
  }

  const parsedDate = chrono.parseDate(choice);
  if (!parsedDate || !isValidDate(parsedDate)) {
    throw new Error(`Unable to parse expiry date: ${choice}`);
  }

  return parsedDate.toISOString();
}

function isValidDate(date: Date | null): boolean {
  return date !== null && !Number.isNaN(date.getTime());
}
