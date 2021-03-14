function applyPluginConfig(plugins, configKey) {
  return (config, ...options) => {
    let updatedConfig = config;
    plugins.forEach(plugin => {
      if (plugin instanceof Array) {
        const [initPlugin, ...rest] = plugin;
        plugin = initPlugin(...rest);
      }
      if (plugin instanceof Function) {
        plugin = plugin();
      }
      if (plugin && plugin[configKey] instanceof Function) {
        updatedConfig = plugin[configKey](config, ...options);
      }
    });
    return updatedConfig;
  }
}

module.exports = (plugins) => ({
  webpack: applyPluginConfig(plugins, 'webpack'),
  webpackDevMiddleware: applyPluginConfig(plugins, 'webpackDevMiddleware'),
});
