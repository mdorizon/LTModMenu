const path = require("path");
const fs = require("fs");
const webpack = require("webpack");

class PrependBannerPlugin {
  apply(compiler) {
    compiler.hooks.compilation.tap("PrependBanner", (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: "PrependBanner",
          stage: webpack.Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_INLINE,
        },
        (assets) => {
          const pkg = JSON.parse(
            fs.readFileSync(path.resolve(__dirname, "package.json"), "utf-8"),
          );
          const rawBanner = fs.readFileSync(
            path.resolve(__dirname, "banner.txt"),
            "utf-8",
          );
          const banner = rawBanner.replace("{{version}}", pkg.version);

          for (const name of Object.keys(assets)) {
            if (!name.endsWith(".js")) continue;

            const code = assets[name].source().toString();
            const result = `${banner.trim()}

// Guard: prevent double execution
if (typeof window !== "undefined" && !window.__ltModMenuLoaded) {
window.__ltModMenuLoaded = true;

${code}

} else if (window.__ltModMenuLoaded) {
  console.warn("[LTModMenu] Already loaded — skipping duplicate execution");
}
`;
            compilation.updateAsset(name, new webpack.sources.RawSource(result));
          }

          compilation.emitAsset(
            "ltmodmenu.meta.js",
            new webpack.sources.RawSource(banner.trim() + "\n"),
          );
        },
      );
    });
  }
}

module.exports = (env, argv) => {
  const isDev = argv.mode === "development";
  const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, "package.json"), "utf-8"));

  return {
    entry: "./src/index.ts",
    output: {
      filename: "ltmodmenu.user.js",
      path: path.resolve(__dirname, "dist"),
      iife: true,
      uniqueName: "ltmodmenu",
    },
    mode: argv.mode || "production",
    optimization: {
      minimize: false,
      moduleIds: "named",
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: "ts-loader",
          exclude: /node_modules/,
        },
      ],
    },
    resolve: {
      extensions: [".ts", ".js"],
      alias: {
        "@core": path.resolve(__dirname, "src/core"),
        "@features": path.resolve(__dirname, "src/features"),
        "@ui": path.resolve(__dirname, "src/ui"),
      },
    },
    plugins: [
      new webpack.DefinePlugin({
        __DEV__: JSON.stringify(isDev),
        __VERSION__: JSON.stringify(pkg.version),
      }),
      new PrependBannerPlugin(),
    ],
  };
};
