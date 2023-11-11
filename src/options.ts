import { normalize } from 'node:path';

type MaybePromise<T> = T | Promise<T>;

export type RenameFunc = (fileName: string, fileExtension: string, fullPath: string) => MaybePromise<string>;

export type Target = {
  /**
   * Path or glob
   */
  src: string;
  /**
   * Destination
   */
  dest: string;
  /**
   * Paths or globs to ignore
   */
  ignore?: string | string[];
  /**
   * Flatten the directory structure
   * @default undefined
   */
  flatten?: boolean;
  /**
   * rename
   */
  rename?: string | RenameFunc;
  /**
   * Should timestamps on copied files be preserved?
   *
   * When false, timestamp behavior is OS-dependent.
   * @default false
   */
  preserveTimestamps?: boolean;
  /**
   * Whether to dereference symlinks.
   *
   * When true, symlinks will be dereferenced.
   * When false, symlinks will not be dereferenced.
   * @default true
   */
  dereference?: boolean;
  /**
   * Whether to overwrite existing file or directory.
   *
   * When true, it will overwrite existing file or directory.
   * When false, it will skip those files/directories.
   * When 'error', it will throw an error.
   *
   * @default true
   */
  overwrite?: boolean | 'error';
};

export type ResolvedTarget = {
  src: string;
  dest: string;
  ignore: string[];
  flatten: boolean;
  rename?: string | RenameFunc;
  preserveTimestamps: boolean;
  dereference: boolean;
  overwrite: boolean;
  errorOnExist: boolean;
};

export type ViteAssetsWatcherOptions = {
  /**
   * Array of targets to watch.
   */
  targets: Target[];
  /**
   * Base directory for targets.
   * @default process.cwd()
   */
  baseDir?: string;
  /**
   * Suppress console output.
   * @default true
   */
  silent?: boolean;
  /**
   * Watch files on serve.
   * @default true
   */
  onServe?: boolean;
  /**
   * Copy files on build.
   * @default true
   */
  onBuild?: boolean;
  /**
   * Watch files on build watch.
   * @default false
   */
  onWatch?: boolean;
};

export type ResolvedViteAssetsWatcherOptions = {
  baseDir: string;
  targets: ResolvedTarget[];
  silent: boolean;
  onServe: boolean;
  onBuild: boolean;
  onWatch: boolean;
};

export const resolveOptions = (options: ViteAssetsWatcherOptions): ResolvedViteAssetsWatcherOptions => ({
  baseDir: normalize(options.baseDir || process.cwd()),
  targets: options.targets.map(
    (target: Target): ResolvedTarget => ({
      src: normalize(target.src),
      dest: normalize(target.dest),
      ignore:
        target.ignore && Array.isArray(target?.ignore)
          ? target.ignore
          : typeof target.ignore === 'string'
          ? [target.ignore]
          : [],
      rename: target.rename,
      flatten: target.flatten ?? true,
      preserveTimestamps: target.preserveTimestamps ?? true,
      dereference: target.dereference ?? true,
      overwrite: target.overwrite === true,
      errorOnExist: target.overwrite === 'error',
    }),
  ),
  silent: options.silent ?? true,
  onServe: options.onServe ?? true,
  onBuild: options.onBuild ?? true,
  onWatch: options.onWatch ?? false,
});
