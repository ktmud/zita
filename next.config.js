const path = require('path');
const withBundleAnalyzer = require('@next/bundle-analyzer');
const compose = require('./next.compose-plugin');

const REGEXP_ANT_STYLES = /antd\/.*?\/style.*?/i;
const REGEXP_LESS = /(styles|pages|components|assets|node_modules)\/.*\.less$/i;

/**
 * Extrat built-in CSS loader rules and apply them to less files, too
 */
function extractCSSRules(allRules) {
  const rules = allRules.find((x) => !!x.oneOf).oneOf;
  const moduleCssRules = rules.filter((x) => String(x.test).includes('/\\.module\\.css$/'));
  const cssRules = rules.filter((x) => String(x.test).includes('/(?<!\\.module)\\.css$/'));
  return [
    ...moduleCssRules.map((x) => ({
      ...x,
      test: /\.module\.less$/,
    })),
    // must manually import antd styles in global.css
    {
      test: REGEXP_ANT_STYLES,
      use: 'null-loader',
    },
    ...cssRules.map((x) => ({
      ...x,
      test: REGEXP_LESS,
    })),
  ];
}

module.exports = compose([
  {
    webpack: (config, { isServer, defaultLoaders }) => {
      // eslint-disable-next-line no-param-reassign
      defaultLoaders.less = {
        loader: 'less-loader',
        options: {
          lessOptions: {
            javascriptEnabled: true,
          },
        },
      };
      config.module.rules.push({
        test: REGEXP_LESS,
        oneOf: extractCSSRules(config.module.rules),
      });
      config.module.rules.push({
        test: REGEXP_LESS,
        use: defaultLoaders.less,
      });

      if (isServer) {
        const origExternals = [...config.externals];
        // eslint-disable-next-line no-param-reassign
        config.externals = [
          // make sure antd styles are collected to build bundles
          (context, request, callback) => {
            if (request.match(REGEXP_ANT_STYLES)) {
              callback();
              return;
            }
            if (typeof origExternals[0] === 'function') {
              origExternals[0](context, request, callback);
            } else {
              callback();
            }
          },
          ...(typeof origExternals[0] === 'function' ? [] : origExternals),
        ];
      }
      config.resolve.modules = [path.resolve(__dirname, 'src'), "node_modules"]
      return config;
    },
  },
  [
    withBundleAnalyzer,
    {
      enabled: process.env.ANALYZE === 'true',
    },
  ],
]);
