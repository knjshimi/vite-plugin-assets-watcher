import { resolveOptions } from './options';
import { servePlugin } from './serve';
import { buildPlugin } from './build';

import type { Plugin } from 'vite';
import type { ViteAssetsWatcherOptions } from './options';

const viteAssetsWatcher = (options: ViteAssetsWatcherOptions): Plugin[] => {
  const resolvedOptions = resolveOptions(options);
  return [servePlugin(resolvedOptions), buildPlugin(resolvedOptions)];
};

export type { ViteAssetsWatcherOptions };
export type { RenameFunc, Target } from './options';

export default viteAssetsWatcher;
