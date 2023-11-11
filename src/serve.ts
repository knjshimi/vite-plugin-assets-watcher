import { basename, dirname, normalize, relative, resolve } from 'node:path';
import micromatch from 'micromatch';
import watcher from '@parcel/watcher';
import { copy, remove } from 'fs-extra';

import { copyAll, unsubscribeAll, logEvent, logEventIgnored, logError, renameTarget, logMessage } from './utils';

import type { ResolvedConfig, Plugin } from 'vite';
import type { AsyncSubscription, SubscribeCallback } from '@parcel/watcher';
import type { ResolvedViteAssetsWatcherOptions } from './options';

export const servePlugin = ({ baseDir, targets, silent, onServe }: ResolvedViteAssetsWatcherOptions): Plugin => {
  let config: ResolvedConfig;
  const subscriptions = new Set<AsyncSubscription>();
  const currentDir: string = resolve();

  return {
    name: 'vite-plugin-assets-watcher:serve',
    apply: 'serve',

    configResolved(_config): void {
      config = _config;
    },

    async buildStart(): Promise<void> {
      if (!onServe) {
        if (!silent) logMessage('Skipping serve', config.logger, 'warn');
        return;
      }

      for (const target of targets) {
        copyAll(baseDir, target, config.logger);
      }

      try {
        for (const target of targets) {
          const srcDir = resolve(baseDir, dirname(target.src));
          const copyOptions = {
            preserveTimestamps: target.preserveTimestamps,
            dereference: target.dereference,
            overwrite: target.overwrite,
            errorOnExist: target.errorOnExist,
          };
          const ignore = target.ignore; //  target.ignore.map((path) => resolve(baseDir, path));

          let destDir: string;
          if (target.flatten) {
            destDir = target.dest;
          } else {
            const dirClean = relative(baseDir, srcDir.replace(/^(?:\.\.\/)+/, ''));
            const destClean = resolve(target.dest, dirClean);
            destDir = destClean;
          }

          const handleSubscriptionEvent: SubscribeCallback = async (err, events) => {
            if (err) {
              logError('parcel watcher error', config.logger);
              if (!silent) config.logger.error(err.message);
            }

            for (const event of events) {
              const eventPath = normalize(event.path);
              const destPath = target.rename
                ? resolve(destDir, await renameTarget(resolve(destDir, basename(eventPath)), target.rename, eventPath))
                : resolve(destDir, basename(eventPath));
              const relativePath = normalize(relative(currentDir, destPath));
              const matches = micromatch.isMatch(resolve(baseDir, eventPath), resolve(baseDir, target.src));

              if (!matches) {
                if (!silent) logEventIgnored(event.type, relativePath, config.logger);
                continue;
              }

              if (event.type === 'delete') {
                remove(destPath).then(
                  () => (!silent ? logEvent(event.type, relativePath, config.logger) : null),
                  (reason) => {
                    logError(`could not delete ${relativePath}`, config.logger);
                    if (!silent) config.logger.error(reason);
                  },
                );
                continue;
              }

              if (event.type === 'create') {
                copy(eventPath, destPath, copyOptions).then(
                  () => (!silent ? logEvent(event.type, relativePath, config.logger) : null),
                  (reason) => {
                    logError(`could not create ${relativePath}`, config.logger);
                    if (!silent) config.logger.error(reason);
                  },
                );
                continue;
              }

              if (event.type === 'update') {
                copy(eventPath, destPath, copyOptions).then(
                  () => (!silent ? logEvent(event.type, relativePath, config.logger) : null),
                  (reason) => {
                    logError(`could not update ${relativePath}`, config.logger);
                    if (!silent) config.logger.error(reason);
                  },
                );
                continue;
              }
            }
          };

          const subscription = await watcher.subscribe(srcDir, handleSubscriptionEvent, { ignore });
          subscriptions.add(subscription);
        }
      } catch (err) {
        await unsubscribeAll(subscriptions, silent, config.logger);
        throw err;
      }
    },

    async buildEnd(): Promise<void> {
      await unsubscribeAll(subscriptions, silent, config.logger);
    },
  };
};
