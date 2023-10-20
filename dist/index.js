import { resolve, relative } from 'node:path';

import micromatch from 'micromatch';
import { copy } from 'fs-extra';
import fastglob from 'fast-glob';
import chalk from 'chalk';

export const CopyAnytime = (config = { copy: true, copyAtStart: true }) => {
  let viteConfig,
    paths = [],
    currentDir = resolve();

  const copyMatchedFiles = (files) => {
    if (files.length > 0) {
      for (let i = 0, il = files.length; i < il; ++i) {
        // Be careful, publicDir seems to be resolved automatically but not build.outDir
        let outDestination = files[i].replace(viteConfig.publicDir, resolve(currentDir, viteConfig.build.outDir));
        viteConfig.logger.info(
          chalk.green('[ViteHmrPublicCopy] ') +
            chalk.dim('copying ') +
            chalk.blue(relative(currentDir, files[i])) +
            chalk.dim(' to ') +
            chalk.blue(relative(currentDir, outDestination)),
        );
        copy(files[i], outDestination).catch((err) => {
          viteConfig.logger.error(chalk.red(`The file "${files[i]}" could not be copied`));
          viteConfig.logger.error(err);
        });
      }
    }
  };

  return {
    name: 'CopyAnytime',
    configResolved(resolvedConfig) {
      viteConfig = resolvedConfig;
      if (config.copy.constructor === Array) {
        paths.concat(config.copy);
      } else if (config.copy) {
        paths.push(`${viteConfig.publicDir}/**/*`);
      }
    },
    async handleHotUpdate({ file }) {
      let matchedFiles = micromatch(file, paths);
      copyMatchedFiles(matchedFiles);
    },
    async buildStart() {
      if (config.copyAtStart) {
        let allFiles = await fastglob(`${viteConfig.publicDir}/**/*`);
        let matchedFiles = micromatch(allFiles, paths);
        copyMatchedFiles(matchedFiles);
      }
    },
  };
};
