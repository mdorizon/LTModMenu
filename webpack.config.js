const path = require("path");
const fs = require("fs");
const webpack = require("webpack");

class WrapInPageInjectorPlugin {
  apply(compiler) {
    compiler.hooks.compilation.tap("WrapInPageInjector", (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: "WrapInPageInjector",
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

            const wrapped = `${banner.trim()}

(function () {
  console.log("[LTModMenu] Userscript loaded, injecting into page context...");
  var script = document.createElement("script");
  script.textContent = ${JSON.stringify(code)};
  if (document.documentElement) {
    document.documentElement.appendChild(script);
  } else {
    document.addEventListener("DOMContentLoaded", function() {
      document.documentElement.appendChild(script);
    });
  }
  script.remove();
  console.log("[LTModMenu] Script tag cleaned up");
})();
`;
            compilation.updateAsset(name, new webpack.sources.RawSource(wrapped));
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
  plugins: [new WrapInPageInjectorPlugin()],
};
