import type { Application, CommandContext, RouteMap } from '@stricli/core';

const isRouteMap = <C extends CommandContext>(target: Application<C>['root']): target is RouteMap<C> =>
  'getAllEntries' in target;

const matchesSegment = (segment: string) => (entry: { name: { original: string }; aliases: readonly string[] }) =>
  entry.name.original === segment || entry.aliases.includes(segment);

// Walks the Stricli route tree to resolve aliased input (e.g. ["org", "ls"] where "ls" is an alias)
// to canonical command names (e.g. "organization:list") for the X-Xata-Agent header which go to backend -> posthog analytics.
export const getCanonicalCommandId = <C extends CommandContext>(
  app: Application<C>,
  rawPrefix: readonly string[]
): string => {
  const segments = rawPrefix[0] === app.config.name ? rawPrefix.slice(1) : rawPrefix;
  const canonical: string[] = [];
  let current: Application<C>['root'] = app.root;

  for (const segment of segments) {
    if (!isRouteMap(current)) break;

    const entry = current.getAllEntries().find(matchesSegment(segment));
    if (!entry) break;

    canonical.push(entry.name.original);
    current = entry.target;
  }

  return canonical.join(':');
};
