import type { LocalContext } from '~/context';
import { getBinary } from '../binary/utils';
import { PINNED_PGSTREAM_BINARY_VERSION } from '../constants';

export function getPgStream(context: LocalContext): Promise<string> {
  return getBinary(context, 'pgstream', PINNED_PGSTREAM_BINARY_VERSION);
}
