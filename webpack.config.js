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
          for (const name of Object.keys(assets)) {
            if (!name.endsWith(".js")) continue;

            const banner = fs.readFileSync(
              path.resolve(__dirname, "banner.txt"),
              "utf-8",
            );
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
        },
      );
    });
  }
}

module.exports = {
  entry: "./src/index.ts",
  output: {
    filename: "ltmodmenu.user.js",
    path: path.resolve(__dirname, "dist"),
    iife: true,
    uniqueName: "ltmodmenu",
  },
  mode: "production",
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
  },
  plugins: [new PrependBannerPlugin()],
};
