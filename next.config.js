// next.config.js
const withCSS = require("@zeit/next-css");
const withLess = require("@zeit/next-less");
const path = require("path");

module.exports = withCSS(
  withLess({
    env: {
      PORT: process.env.PORT,
      ZT_API_ROOT: process.env.ZT_API_ROOT
    },
    webpack: (config, { isServer }) => {
      if (isServer) {
        const antStyles = /antd\/.*?\/style\/css.*?/;
        const origExternal = config.externals[0];
        config.externals.unshift((context, request, callback) => {
          if (request.match(antStyles)) {
            callback();
            return;
          }
          if (typeof origExternal === "function") {
            origExternal(context, request, callback);
          } else {
            callback();
          }
        });
        if (typeof origExternal === "function") {
          config.externals.splice(1, 1);
        }
        config.module.rules.unshift({
          test: antStyles,
          use: "null-loader"
        });
      }

      config.module.rules.push({
        test: /\.(png|jpg|gif|svg|eot|ttf|woff|woff2)$/,
        use: {
          loader: "url-loader",
          options: {
            limit: 100000
          }
        }
      });
      config.module.rules.push({
        loader: "webpack-ant-icon-loader",
        enforce: "pre",
        // options:{
        //   chunkName:'antd-icons'
        // },
        include: [require.resolve("@ant-design/icons/lib/dist")]
      });

      // resolve local directory
      config.resolve.modules.push(path.resolve("./"));

      config.stats = {};
      config.stats.warnings = false;
      config.stats.warningsFilter = warning => {
          return /Conflicting order between/gm.test(warning);
      };

      return config;
    }
  })
);
