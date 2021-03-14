import fs from "fs";
import { promisify } from "util";
import Debug from "debug";
import { TAG_OUTPUT } from "server/settings";
import FileStore from "./store/FileStore";
import RedisStore from "./store/RedisStore";

export const ptStoreLog = Debug("ZT.store");
export const ptApiDebug = Debug("ZT.api");

const store =
  typeof TAG_OUTPUT !== "string" || TAG_OUTPUT.indexOf("redis://") === 0
    ? new RedisStore(TAG_OUTPUT)
    : new FileStore(TAG_OUTPUT);

let finalPersist = () => {
  // cancel any future calls to persist method
  finalPersist = () => null;

  store
    .persist(true)
    .then(() => {
      ptStoreLog("FinalPersist done. Exit.");
      process.exit();
    })
    .catch(error => {
      ptStoreLog("FinalPersist failed.", error);
      process.exit(error.errno || 1);
    });
  // cancel autopersit calls as well
  store.autoPersist = () => null;
};
process.once("SIGINT", () => {
  finalPersist();
});
process.once("SIGTERM", () => {
  finalPersist();
});

export const readdir = promisify(fs.readdir);
export const RE_IMG_FILE = /.(jpe?g|png|gif)$/i;

export const isImageFile = filename => RE_IMG_FILE.test(filename);

export const getStats = (filepath, dirOnly) => {
  let stats;
  try {
    stats = fs.lstatSync(filepath);
  } catch (error) {
    // if error is not "file not exists"
    if (error.code !== "ENOENT") {
      ptApiDebug(error);
    }
    return null;
  }
  if (dirOnly && !stats.isDirectory()) {
    return null;
  }
  const { atimeMs, mtimeMs, ctimeMs, size } = stats;
  return { atimeMs, mtimeMs, ctimeMs, size };
};

/**
 * Execute a list of arguments in one single promise,
 * but return a list of promises to resolve the batch request.
 */
export const batchPromises = (args, func) => {
  const promise = func(args);
  const callbacks = [];
  const errorCallbacks = [];

  // ptStoreLog("Start batch job %s for %s items...", funcName, args.length);
  promise
    .then(res => {
      // ptStoreLog("Bath job %s for %s items done.", funcName, args.length);
      callbacks.forEach((cb, i) => cb(res[i]));
    })
    .catch(error => {
      errorCallbacks.forEach(cb => cb(error));
    });

  return args.map((x, i) => {
    return new Promise((resolve, reject) => {
      callbacks[i] = resolve;
      errorCallbacks[i] = reject;
    });
  });
};

export default store;
