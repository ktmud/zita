/* eslint-disable no-await-in-loop */
import path from "path";
import { ALBUMS_ROOT } from "server/settings";
import store, { readdir, getStats, isImageFile } from "server/store";
import Debug from "debug";
import { albumPhotos, tagPhoto, tagPhotos, preds } from "./photo";
import { tagOptions, modelOptions, defaultModel } from "./utils";

const albumTitle = id => (Number.isNaN(parseInt(id, 10)) ? id : `Album ${id}`);
const ptDebug = Debug("ZT.gql");

/**
 * List All albums (subdirectories) under ALBUMS_ROOT
 */
const albums = async (parent, { limit: limit_ = 20, offset = 0 }) => {
  const children = await readdir(ALBUMS_ROOT);
  const ret = [];
  const total = children.length;
  let limit = limit_;
  if (total === 0) {
    throw new Error("Albums folder is empty.");
  }
  if (limit <= 0 || limit > total) {
    limit = total;
  }
  let i = 0;
  let j = 0;
  let k = 0;
  // ptDebug("Reading album dir stats..");
  while (i < total && k < limit) {
    const kid = children[i];
    i += 1;
    const albumDir = path.join(ALBUMS_ROOT, kid);
    const obj = getStats(albumDir, true);
    if (obj) {
      j += 1;
      if (j > offset) {
        k += 1;
        obj.id = kid;
        obj.idx = i - 1;
        obj.title = albumTitle(kid);
        ret.push(obj);
      }
    }
  }
  // ptDebug("Done reading album dir stats.");
  return ret;
};

/**
 * List all photos under an album subfolder
 */
const album = async (parent, { id }) => {
  const albumDir = path.join(ALBUMS_ROOT, id);
  const obj = await getStats(albumDir);
  if (obj) {
    obj.id = id;
    obj.title = albumTitle(id);
    return obj;
  }
  return null;
};

/**
 * Total photo counts
 */
album.totalPhotos = async ({ id }) => {
  const albumDir = path.join(ALBUMS_ROOT, id);
  const albumContents = await readdir(albumDir);
  return albumContents.filter(isImageFile).length;
};

/**
 * Count of tagged photos
 */
album.taggedPhotos = async ({ id }) => {
  const ret = await store.taggedCount(id);
  return ret;
};

/**
 * Number of active taggers in an album
 */
album.taggers = async ({ id }, args, context) => {
  const ret = await store.taggersCount(id, context.ztuid);
  return ret;
};

/**
 * List photos in an album
 */
album.photos = albumPhotos;

/**
 * Find next available album (the unefficient way...)
 */
export const nextAvailAlbum = async (parent, { checkTaggers }, context) => {
  const albs = await albums(parent, { limit: -1 }, context);
  let idx = 0;
  if (checkTaggers) {
    while (idx < albs.length) {
      const alb = albs[idx];
      const res = [
        album.taggers(alb, {}, context),
        album.taggedPhotos(alb),
        album.totalPhotos(alb)
      ];
      [alb.taggers, alb.taggedPhotos, alb.totalPhotos] = await Promise.all(res);
      if (!alb.taggers && alb.taggedPhotos < alb.totalPhotos) break;
      idx += 1;
    }
  }
  // if nothing found, return a random album
  if (idx === albums.length) {
    idx = Math.floor(Math.random() * albs.length);
  }
  return albs[idx];
};

/**
 * Dump photo tags for a speficied album or all photos (if albumId is not
 * provided or is "__all__").
 */
const taggedPhotos = async (parent, { albumId }) => {
  return Object.entries(await store.dump(albumId)).map(([id, tags]) => {
    return {
      id,
      tags
    };
  });
};

export default {
  Query: {
    albums,
    album,
    taggedPhotos,
    tagOptions,
    modelOptions,
    defaultModel,
    preds,
    nextAvailAlbum
  },
  Album: album,
  Mutation: {
    tagPhoto,
    tagPhotos
  }
};
