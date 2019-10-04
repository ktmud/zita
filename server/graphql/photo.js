import path from "path";
import { ALBUMS_ROOT, ALBUM_DELIM, DEFAULT_MODEL } from "server/settings";
import store, {
  readdir,
  isImageFile,
  getStats,
  batchPromises,
  ptApiDebug
} from "server/store";
import backend from "server/backend";

/**
 * Photo related resolvers
 */
export const albumPhotos = async (
  parent,
  { limit: limit_ = 100, offset = 0 },
  ctx,
  info
) => {
  const albumId = parent.id;
  const albumDir = path.join(ALBUMS_ROOT, albumId);
  const children = await readdir(albumDir);
  const ret = [];
  const total = children.length;
  let limit = limit_;
  if (limit <= 0 || limit > total) {
    limit = total;
  }
  // i - the global counter
  // j - used to respect offset
  // k - used to respect limit
  let i = 0;
  let j = 0;
  let k = 0;
  while (i < total && k < limit) {
    const kid = children[i];
    i += 1;
    // if not a image, skip
    if (isImageFile(kid)) {
      j += 1;
      if (j > offset) {
        k += 1;
        const obj = getStats(path.join(albumDir, kid));
        // photo id consists of the album name and photo filename
        obj.id = `${albumId}${ALBUM_DELIM}${kid}`;
        obj.idx = j - 1;
        ret.push(obj);
      }
    }
  }
  if (!ret.length) {
    return ret;
  }

  // get tags for all photos in batch
  const photoIds = ret.map(x => x.id);

  const additionalFields = {};
  info.fieldNodes[0].selectionSet.selections.forEach(async x => {
    const field = x.name.value;
    // skip existing fields
    if (field in ret[0]) {
      return;
    }
    let value;
    if (field === "tags") {
      value = batchPromises(photoIds, store.mget.bind(store), "photo.tags");
    } else if (field === "predTags") {
      // update prediction model as asked
      const modelArg = x.arguments.find(arg => arg.name.value === "model");
      // or fallback to the one set in ctx (cookie)
      const model =
        (modelArg && modelArg.value.value) || ctx.model || DEFAULT_MODEL;
      if (backend.setModel) {
        backend.setModel(model);
      }
      ptApiDebug(
        "Fetching [model: %s] preds for %d photos.",
        model,
        photoIds.length
      );
      value = batchPromises(
        photoIds,
        backend.predictBatch.bind(backend),
        "photo.predTags"
      );
    }
    additionalFields[field] = value;
  });

  // assign additional fields to each photo one by one
  ret.forEach((obj, idx) => {
    Object.entries(additionalFields).forEach(([field, value]) => {
      // eslint-disable-next-line no-param-reassign
      obj[field] = value[idx];
    });
  });
  return ret;
};

/**
 * Photo predictions
 */
export const preds = async (
  parent,
  { photoIds, model = DEFAULT_MODEL },
  ctx,
  info
) => {
  if (backend.setModel) {
    backend.setModel(model || ctx.model);
  }
  let tagsOnly = true;
  info.fieldNodes[0].selectionSet.selections.forEach(x => {
    const field = x.name.value;
    if (field !== "tags") {
      tagsOnly = false;
    }
  });
  const ret = await backend.predictBatch(photoIds, { tagsOnly });
  if (tagsOnly) {
    return ret.map(tags => ({ tags }));
  }
  return ret;
};

/**
 * Update photo tags
 */
export const tagPhoto = async (parent, { id, tags }, ctx) => {
  const { ztuid } = ctx;
  const [prevTags, incr] = await store.tag(id, tags, ztuid);
  const taggers = await store.taggersCount(store.albumId(id), ztuid);
  return {
    id,
    tags,
    incr,
    taggers,
    prevTags
  };
};

export const tagPhotos = (parent, { photos }) => {
  return photos.map(({ id, tags }) => {
    return tagPhoto(null, { id, tags });
  });
};
