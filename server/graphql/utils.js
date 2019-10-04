import { TAG_OPTIONS, MODELS_ROOT, DEFAULT_MODEL } from "server/settings";
import { readdir } from "server/store";

export const tagOptions = () => {
  return TAG_OPTIONS;
};

/**
 * List all model options in MODLES_ROOT
 */
export const modelOptions = async () => {
  const ret = await readdir(MODELS_ROOT);
  return ret.filter(x => x.endsWith(".pkl")).map(x => x.replace(".pkl", ""));
};

export const defaultModel = () => {
  // if (!model) {
  //   const models = await modelOptions();
  //   // pick the first if not set
  //   [model] = models;
  // }
  return DEFAULT_MODEL;
};
