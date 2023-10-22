import { basename, normalize, relative, resolve } from 'node:path';

import chalk from 'chalk';
import fastglob from 'fast-glob';
import { copy } from 'fs-extra';

import type { Logger } from 'vite';
import type { Target, Renamer } from './index.js';

export const copyAll = async (target: Target, logger: Logger): Promise<void> => {
  if (!target || !target.src) return;

  const files: string[] = await fastglob(target.src);
  if (!files.length) return;

  const currentDir: string = resolve();
  const rename: Renamer = target.rename ?? ((filePath) => filePath);

  for (const file of files) {
    const src = normalize(resolve(file));
    const dest = normalize(resolve(target.dest, basename(rename(file))));

    try {
      await copy(src, dest);

      logger.info(
        `${chalk.green('[assetsWatcher] ' + relative(currentDir, dest))}${chalk.dim(' from ')}${chalk.blue(
          relative(currentDir, src.replace(basename(file), '')),
        )}`,
      );
    } catch (err) {
      if (err instanceof Error) {
        logger.error(
          chalk.red(`The file "${relative(currentDir, file.replace(basename(file), ''))}" could not be copied`),
        );
        logger.error(err.message);
      }
    }
  }
};
