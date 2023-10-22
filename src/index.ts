import { basename, dirname, normalize, relative, resolve } from 'node:path';

import chalk from 'chalk';
import micromatch from 'micromatch';
import watcher from '@parcel/watcher';
import { copy, remove } from 'fs-extra';

import { copyAll } from './utils';

import type { ResolvedConfig, Plugin } from 'vite';
import type { AsyncSubscription } from '@parcel/watcher';

export type Renamer = {
  (filePath: string): string;
};

export type Target = {
  src: string;
  dest: string;
  rename?: Renamer;
};

export type PluginConfig = {
  targets: Target[];
  silent?: boolean;
};

const viteAssetsWatcher = (config: PluginConfig = { targets: [], silent: true }): Plugin => {
  let viteConfig: ResolvedConfig;
  const subscriptions = new Set<AsyncSubscription>();
  const targets: Target[] = config.targets;
  const currentDir: string = resolve();

  return {
    name: 'vite-plugin-assets-watcher',

    async configResolved(resolvedConfig: ResolvedConfig): Promise<void> {
      viteConfig = resolvedConfig;
    },

    async closeBundle(): Promise<void> {
      for (const target of targets) {
        copyAll(target, viteConfig.logger);
      }

      if (!this.meta.watchMode) {
        return;
      }

      try {
        for (const target of targets) {
          const rename = target.rename ?? ((filePath) => filePath);

          const subscription = await watcher.subscribe(normalize(resolve(dirname(target.src))), async (err, events) => {
            if (err) {
              viteConfig.logger.error(chalk.red('[assetsWatcher] Parcel watcher error'));
              throw err;
            }

            for (const event of events) {
              const dest = normalize(resolve(target.dest, rename(basename(event.path))));
              const matches = micromatch.isMatch(normalize(event.path), normalize(resolve(target.src)));

              if (!matches) {
                if (!config.silent) {
                  viteConfig.logger.info(
                    chalk.yellow('[assetsWatcher] ' + event.type + ': ' + relative(currentDir, dest) + ' (ignored)'),
                  );
                }
                continue;
              }

              if (event.type === 'delete') {
                await remove(dest);
                if (!config.silent) {
                  viteConfig.logger.info(
                    chalk.dim('[assetsWatcher] ' + event.type + 'd: ' + relative(currentDir, dest)),
                  );
                }
                continue;
              }

              if (event.type === 'create' || event.type === 'update') {
                await copy(event.path, dest);
                if (!config.silent) {
                  viteConfig.logger.info(
                    chalk.green('[assetsWatcher] ' + event.type + 'd: ' + relative(currentDir, dest)),
                  );
                }
                continue;
              }
            }
          });

          subscriptions.add(subscription);
        }
      } catch (err) {
        for (const subscription of subscriptions) {
          await subscription.unsubscribe();
          subscriptions.delete(subscription);
        }

        throw err;
      }
    },

    async closeWatcher(): Promise<void> {
      if (!subscriptions.size) return;

      for (const subscription of subscriptions) {
        await subscription.unsubscribe();
        subscriptions.delete(subscription);
      }

      viteConfig.logger.info(chalk.green('[assetsWatcher] ') + chalk.dim('Closed Parcel watchers'));
    },
  };
};

export default viteAssetsWatcher;
