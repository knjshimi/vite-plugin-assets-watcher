# Vite Plugin Assets Watcher

For those who need to watch static assets, keeping the target destination folder always in sync.

## Motivation

In my Shopify theme projects that use vite and [vite-plugin-shopify](https://github.com/barrel/shopify-vite/tree/main/packages/vite-plugin-shopify), I couldn't get [vite-plugin-static-copy](https://github.com/sapphi-red/vite-plugin-static-copy) to work for my needs. I needed a plugin to always keep static assets up to date in the `dist` folder, so [Shopify CLI](https://github.com/Shopify/cli) could upload them to the store theme straight away.

I haven't thoroughly tested this plugin, so _use at your own risk_.

Feedbacks are welcome.

## Installation

```shell
npm i -D vite-plugin-assets-watcher # npm
yarn add -D vite-plugin-assets-watcher # yarn
```

## Example usage

```js
// vite.config.js
import viteAssetsWatcher from 'vite-plugin-assets-watcher';

export default defineConfig({
  plugins: [
    viteAssetsWatcher({
      targets: [
        {
          src: 'static/fonts/*.{woff,woff2,ttf,otf,svg}',
          dest: 'assets',
        },
        {
          src: 'static/images/*.{jpg,jpeg,gif,png,webp}',
          dest: 'assets',
        },
        {
          src: 'static/svg/*.svg',
          dest: 'snippets',
          rename: (filePath) => filePath.replace('.svg', '.liquid'),
        },
      ],
    }),
  ],
});
```

```json
{
  "name": "my-project",
  "scripts": {
    "watch": "vite build --watch"
  }
}
```

```shell
npm run watch
# yarn watch
```

Assets are simply copied after build (_non-watch mode_) on vite's `closeBundle` hook, so if you need to clear out old assets in the dist folder, you can use vite's `build.emptyOutDir: true` config option.

Note: you can run both `vite` and `vite build --watch` at the same time with the help of `npm-run-all` or `concurrently`, by using two terminals, or even directly in `package.json`, example:

```json
{
  "name": "my-project",
  "scripts": {
    "dev": "vite & vite build --watch"
  }
}
```

```shell
npm run dev
# yarn dev
```

## Acknowledgements

- [Vite Plugin Shopify](https://github.com/barrel/shopify-vite/tree/main/packages/vite-plugin-shopify) by [Barrel/NY](https://github.com/barrel) (Thanks for the amazing plugins!)
- [Vite Plugin Static Copy](https://github.com/sapphi-red/vite-plugin-static-copy)
