import { basename, dirname, relative, resolve, sep, parse } from 'node:path';
import pc from 'picocolors';
import fastglob from 'fast-glob';
import { copy } from 'fs-extra';

import type { Logger } from 'vite';
import type { ResolvedTarget, RenameFunc } from './options.js';
import type { AsyncSubscription } from '@parcel/watcher';

export const logMessage = (
  message: string,
  logger: Logger,
  level: 'success' | 'warn' | 'error' | 'info' | undefined,
) => {
  const color =
    level === 'success'
      ? pc.green
      : level === 'warn'
      ? pc.yellow
      : level === 'error'
      ? pc.red
      : level === 'info'
      ? pc.cyan
      : pc.dim;

  logger.info(pc.dim('[assetsWatcher] ') + color(message));
};

export const logSuccess = (message: string, logger: Logger) => logMessage(message, logger, 'success');
export const logWarn = (message: string, logger: Logger) => logMessage(message, logger, 'warn');
export const logError = (message: string, logger: Logger) => logMessage(message, logger, 'error');
export const logInfo = (message: string, logger: Logger) => logMessage(message, logger, 'info');

const logCopySuccess = (dest: string, src: string, logger: Logger) => {
  const currentDir: string = resolve();
  logger.info(
    pc.dim(`[assetsWatcher] ${relative(currentDir, dirname(dest))}${sep}`) +
      pc.green(basename(dest)) +
      pc.dim(` from ${relative(currentDir, dirname(src))}`),
  );
};

const logCopyError = (dest: string, src: string, logger: Logger) => {
  const currentDir: string = resolve();
  logger.info(
    pc.dim(`[assetsWatcher] could not copy ${relative(currentDir, dirname(dest))}${sep}`) +
      pc.red(basename(dest)) +
      pc.dim(` from ${relative(currentDir, dirname(src))}`),
  );
};

export const logEvent = (type: 'create' | 'update' | 'delete' | 'ignore', path: string, logger: Logger) => {
  const color =
    type === 'delete'
      ? pc.red
      : type === 'create'
      ? pc.green
      : type === 'update'
      ? pc.cyan
      : type === 'ignore'
      ? pc.yellow
      : pc.dim;

  logger.info(
    pc.dim(`[assetsWatcher] ${dirname(path)}${path.includes(sep) ? sep : ''}`) +
      color(basename(path)) +
      pc.dim(` ${type}d`),
    { timestamp: true },
  );
};

export const logEventIgnored = (type: 'create' | 'update' | 'delete', path: string, logger: Logger) => {
  logger.info(
    pc.dim(`[assetsWatcher] ${dirname(path)}${path.includes(sep) ? sep : ''}`) +
      pc.yellow(basename(path)) +
      pc.dim(` ${type} ignored`),
    { timestamp: true },
  );
};

export async function renameTarget(target: string, rename: string | RenameFunc, src: string): Promise<string> {
  const parsedPath = parse(target);

  if (typeof rename === 'string') {
    return rename;
  }

  return rename(parsedPath.name, parsedPath.ext.replace('.', ''), src);
}

export const copyAll = async (baseDir: string, target: ResolvedTarget, logger: Logger): Promise<void> => {
  if (!target || !target.src) return;

  const srcPaths: string[] = await fastglob(resolve(baseDir, target.src));
  if (!srcPaths.length) return;

  const { flatten, overwrite, preserveTimestamps, dereference, errorOnExist } = target;

  for (const srcPath of srcPaths) {
    const { base: file, dir: srcDir } = parse(srcPath);

    let destDir: string;
    if (flatten || !srcDir) {
      destDir = target.dest;
    } else {
      const relativeDestDir = relative(baseDir, srcDir);
      destDir = resolve(target.dest, relativeDestDir);
    }

    const destPath = target.rename
      ? resolve(destDir, await renameTarget(resolve(destDir, file), target.rename, srcPath))
      : resolve(destDir, file);

    copy(srcPath, destPath, {
      preserveTimestamps,
      dereference,
      overwrite,
      errorOnExist,
    }).then(
      () => logCopySuccess(destPath, srcPath, logger),
      () => logCopyError(destPath, srcPath, logger),
    );
  }
};

export const unsubscribeAll = async (subscriptions: Set<AsyncSubscription>, silent: boolean, logger: Logger) => {
  try {
    for (const subscription of subscriptions) {
      await subscription.unsubscribe();
      subscriptions.delete(subscription);
    }

    if (!silent) logSuccess('closed watchers', logger);
  } catch (err) {
    logError('error closing watchers', logger);

    if (err instanceof Error) {
      logger.error(err.message);
    }
  }
};
