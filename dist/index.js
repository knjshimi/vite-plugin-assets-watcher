import { basename, dirname, normalize, relative, resolve } from 'node:path';
import { copyFileSync, rmSync } from 'node:fs';
import { copyFile } from 'node:fs/promises';
import { constants } from 'node:fs';

import chalk from 'chalk';
import fastglob from 'fast-glob';
import micromatch from 'micromatch';
import watcher from '@parcel/watcher';

/**
 * @typedef {import('vite').ResolvedConfig} ResolvedConfig
 * @typedef {import('vite').Plugin} Plugin
 * @typedef {import('@parcel/watcher').AsyncSubscription} AsyncSubscription
 * @typedef {import('fast-glob').Pattern} Pattern
 */

/**
 * @typedef {function} RenameFunction
 * @param {string} filePath
 * @returns {string}
 */

/**
 * @typedef {object} Target
 * @property {Pattern} src
 * @property {string} dest
 * @property {RenameFunction|undefined} [rename]
 */

/**
 * @typedef {object} PluginConfig
 * @property {Target[]} targets
 * @property {boolean} quiet
 */

/**
 * @param {PluginConfig} config
 * @returns {Plugin}
 */
const copyAnytime = (config = { targets: [], quiet: true }) => {
  /** @type {ResolvedConfig} */
  let viteConfig;

  /** @type {Set<AsyncSubscription>} */
  let subscriptions = new Set();

  /** @type {Target[]} */
  const targets = config.targets;

  /** @type {string} */
  const currentDir = resolve();

  /**
   * @param {Target} target
   * @returns {Promise<void>}
   */
  const copyMatchedFiles = async (target) => {
    if (!target || !target.src) return;

    /** @type {string[]} */
    const files = await fastglob(target.src);
    if (!files.length) return;

    /** @type {RenameFunction} */
    const rename = target.rename ? target.rename : (/** @type {string} */ filePath) => filePath;

    for (let i = 0, il = files.length; i < il; ++i) {
      const src = normalize(resolve(files[i]));
      const dest = normalize(resolve(target.dest, basename(rename(files[i]))));

      viteConfig.logger.info(
        chalk.green('[copyAnytime] ' + relative(currentDir, dest)) +
          chalk.dim(' from ') +
          chalk.blue(relative(currentDir, src.replace(basename(files[i]), ''))),
      );

      copyFile(src, dest, constants.COPYFILE_FICLONE).catch((/** @type {Error} */ err) => {
        viteConfig.logger.error(
          chalk.red(`The file "${relative(currentDir, files[i].replace(basename(files[i]), ''))}" could not be copied`),
        );
        viteConfig.logger.error(err.message);
      });
    }
  };

  return {
    name: 'CopyAnytime',

    /**
     * @async
     * @param {ResolvedConfig} resolvedConfig
     * @returns {Promise<void>}
     */
    async configResolved(resolvedConfig) {
      viteConfig = resolvedConfig;
    },

    /**
     * @async
     * @returns {Promise<void>}
     */
    async closeBundle() {
      for (const target of targets) {
        copyMatchedFiles(target);
      }

      if (!this.meta.watchMode) {
        return;
      }

      try {
        for (const target of targets) {
          const rename = target.rename ? target.rename : (/** @type {string} */ filePath) => filePath;

          const subscription = await watcher.subscribe(normalize(resolve(dirname(target.src))), (err, events) => {
            if (err) {
              viteConfig.logger.error(chalk.red(`[copyAnytime] Parcel watcher error`));
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

    /**
     * @async
     * @returns {Promise<void>}
     */
    async closeWatcher() {
      if (!subscriptions.size) return;

      for (const subscription of subscriptions) {
        await subscription.unsubscribe();
        subscriptions.delete(subscription);
      }

      viteConfig.logger.info(chalk.green('[copyAnytime] ') + chalk.dim('Closed Parcel watchers'));
    },
  };
};

export default copyAnytime;
