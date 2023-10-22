import { basename, dirname, normalize, relative, resolve } from 'node:path';
import { copyFileSync, rmSync } from 'node:fs';
import { copyFile } from 'node:fs/promises';
import { constants } from 'node:fs';

import chalk from 'chalk';
import fastglob from 'fast-glob';
import micromatch from 'micromatch';
import watcher from '@parcel/watcher';

import type { ResolvedConfig, Plugin } from 'vite';
import type { AsyncSubscription } from '@parcel/watcher';

type Renamer = {
  (filePath: string): string;
};

type Target = {
  src: string;
  dest: string;
  rename?: Renamer;
};

type PluginConfig = {
  targets: Target[];
  quiet: boolean;
};

const viteAssetsWatcher = (config: PluginConfig = { targets: [], quiet: true }): Plugin => {
  let viteConfig: ResolvedConfig;
  const subscriptions = new Set<AsyncSubscription>();
  const targets: Target[] = config.targets;
  const currentDir: string = resolve();

  const copyMatchedFiles = async (target: Target): Promise<void> => {
    if (!target || !target.src) return;

    const files: string[] = await fastglob(target.src);
    if (!files.length) return;

    const rename: Renamer = target.rename ?? ((filePath) => filePath);

    for (const file of files) {
      const src = normalize(resolve(file));
      const dest = normalize(resolve(target.dest, basename(rename(file))));

      viteConfig.logger.info(
        `${chalk.green('[copyAnytime] ' + relative(currentDir, dest))}${chalk.dim(' from ')}${chalk.blue(
          relative(currentDir, src.replace(basename(file), '')),
        )}`,
      );

      copyFile(src, dest, constants.COPYFILE_FICLONE).catch((err) => {
        viteConfig.logger.error(
          chalk.red(`The file "${relative(currentDir, file.replace(basename(file), ''))}" could not be copied`),
        );
        viteConfig.logger.error(err.message);
      });
    }
  };

  return {
    name: 'vite-plugin-assets-watcher',

    async configResolved(resolvedConfig: ResolvedConfig): Promise<void> {
      viteConfig = resolvedConfig;
    },

    async closeBundle(): Promise<void> {
      for (const target of targets) {
        copyMatchedFiles(target);
      }

      if (!this.meta.watchMode) return;

      try {
        for (const target of targets) {
          const rename = target.rename ?? ((filePath) => filePath);

          const subscription = await watcher.subscribe(normalize(resolve(dirname(target.src))), async (err, events) => {
            if (err) {
              viteConfig.logger.error(chalk.red('[copyAnytime] Parcel watcher error'));
              throw err;
            }

            for (const event of events) {
              const dest = normalize(resolve(target.dest, rename(basename(event.path))));

              const matches = micromatch.isMatch(event.path, normalize(resolve(target.src)));
              if (!matches) {
                viteConfig.logger.info(
                  chalk.yellow('[copyAnytime] ' + event.type + ': ' + relative(currentDir, dest) + ' (ignored)'),
                );
                continue;
              }

              if (event.type === 'delete') {
                rmSync(dest);
                viteConfig.logger.info(chalk.dim('[copyAnytime] ' + event.type + 'd: ' + relative(currentDir, dest)));
                continue;
              }

              if (event.type === 'create' || event.type === 'update') {
                copyFileSync(event.path, dest);
                viteConfig.logger.info(chalk.green('[copyAnytime] ' + event.type + 'd: ' + relative(currentDir, dest)));
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

      viteConfig.logger.info(chalk.green('[copyAnytime] ') + chalk.dim('Closed Parcel watchers'));
    },
  };
};

export default viteAssetsWatcher;
