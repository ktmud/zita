/**
 * Obtain config values from environment variables
 */
const os = require("os");

const { env } = process;

const config = (envName, defaultVal) => {
  return env[envName] || defaultVal;
};
const expandHomeDir = filepath => {
  return filepath.replace(/^~/, os.homedir());
};

// server side always read from localhost, this is needed in case
// of Dokku's zero-down time deployment, the checks needs to connect to the
// new server instance, instead of the current active one.
const localAPI = `http://localhost:${config("PORT", 3000)}/api`;
const rpcEndpoint = `tcp://localhost:${config("ZT_RPC_PORT", 3002)}`;

export const isServer = typeof process !== "undefined" && !process.browser;
export const SSR_API_ROOT = config("ZT_SSR_API_ROOT", localAPI);
export const CLIENT_API_ROOT = config("ZT_API_ROOT", "/api");
export const BACKEND_API_ROOT = config("ZT_BACKEND_ROOT", rpcEndpoint);
export const API_ROOT = isServer ? SSR_API_ROOT : CLIENT_API_ROOT;
export const GQL_ROOT = `${API_ROOT}/graphql`;
// defaults will select Redis database 0
export const REDIS_URL = config(
  "ZT_REDIS_URL",
  config("REDIS_URL", "redis://localhost:6379")
);
// point celery broker to Redis database 1
export const CELERY_BROKER_URL = config(
  "ZT_CELERY_BROKER_URL",
  `${REDIS_URL}/1`
);

// tags choices, separated by "||"
const DEFAULT_TAG_OPTIONS = "Good||Fair||Bad";

// delimiter between album id and photo id in storage keys
export const ALBUM_DELIM = config("ZT_ALBUM_DELIM", " ~ ");
// where the photos are located
export const ALBUMS_ROOT = expandHomeDir(
  config("ZT_ALBUMS_ROOT", "./example/data")
);
// where the models are located
export const MODELS_ROOT = expandHomeDir(
  config("ZT_MODELS_ROOT", "./python/notebook/models")
);
export const DEFAULT_MODEL = config("ZT_DEFAULT_MODEL", "default");

// output tags to a CSV file, which will be used as the basis of training data
// write to a local file because it makes things easier to transfer data between
// different machines (GPU-powered training machine and the CPU-based serving host)
export const LABELS_CSV = config("ZT_LABELS_CSV", `${ALBUMS_ROOT}/tags.csv`);
export const TAG_OPTIONS = config("ZT_TAG_OPTIONS", DEFAULT_TAG_OPTIONS).split(
  "||"
);
// Where to store the tags, defaults to `tags.csv` in the root folder
//
// Or use Redis:
//
//   env ZT_TAG_OUTPUT='redis://localhost:6379' npm start
//
export const TAG_OUTPUT = env.ZT_TAG_OUTPUT || env.REDIS_URL || LABELS_CSV;
