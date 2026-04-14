import type { LocalContext } from '~/context';
import { getBinary } from '../binary/utils';
import { PINNED_PGROLL_BINARY_VERSION } from '../constants';

export function getPgRoll(context: LocalContext): Promise<string> {
  return getBinary(context, 'pgroll', PINNED_PGROLL_BINARY_VERSION);
}
