import Debug from "debug";
import Redis from "ioredis";
import { ALBUM_ALL } from "lib/client";
import { ALBUM_DELIM, LABELS_CSV } from "server/settings";
import FileStore from "./FileStore";

const ptStoreLog = Debug("ZT.store.redis");

// function sleep(millis) {
//   return new Promise(resolve => setTimeout(resolve, millis));
// }

export default class RedisStore extends FileStore {
  COUNTS = "zt:taggedCounts";

  TAGGED = "zt:tagged";

  TAGGERS = "zt:taggers";

  init(options) {
    ptStoreLog("Init with RedisStore", options);
    this.client = new Redis(options);
    ptStoreLog("Load %s into redis if exists...", LABELS_CSV);
    this.load(LABELS_CSV).then(prevTags => {
      // set tags, but don't trigger sync, will do it manually
      // in the callback.
      this.mset(prevTags, false).then(success => {
        if (success) {
          ptStoreLog(
            "Loaded %d entries into Redis.",
            Object.keys(prevTags).length
          );
          // automatically save all tags
          this.persist(true);
        }
      });
    });
  }

  async incr(albumId, stepSize = 1) {
    const ret = await this.client.hincrby(this.COUNTS, albumId, stepSize);
    return ret;
  }

  async taggedCount(albumId) {
    const count = (await this.client.hget(this.COUNTS, albumId)) || 0;
    // make sure the count is not less than zero
    if (count < 0) {
      await this.client.hset(this.COUNTS, albumId, 0);
    }
    return Math.max(count, 0);
  }

  taggerAlbumKey(albumId) {
    return `${this.TAGGERS}-${albumId}`;
  }

  /**
   * Query how many users are tagging the same album, minus current user
   *
   * @param {String} albumId - which album to query
   * @param {String} ztuid - which user is querying this
   *    (who will be added to current list of active users)
   */
  async taggersCount(albumId, ztuid) {
    // await sleep(1000);
    const albumKey = this.taggerAlbumKey(albumId);
    const results = Object.entries(await this.client.hgetall(albumKey));
    if (!results || !results.length) return 0;
    let currentUser = 0;
    const now = Date.now();
    const expired = results
      .filter(([key, val]) => {
        const old = parseInt(val, 10) + this.TAGGING_TIMEOUT < now;
        if (ztuid && key === ztuid && !old) {
          currentUser = 1;
        }
        return old;
      })
      .map(x => x[0]);
    if (expired.length > 0) {
      // delete the expired keys
      await this.client.hdel(albumKey, ...expired);
    }
    // minus the count for current user
    return results.length - expired.length - currentUser;
  }

  async setTagger(albumId, ztuid) {
    const albumKey = this.taggerAlbumKey(albumId);
    const ret = await this.client.hset(albumKey, ztuid, Date.now());
    return ret;
  }

  /**
   * Get current tags of a photo
   */
  async get(photoId) {
    const ret = await this.client.hget(this.TAGGED, photoId);
    // always sort the tags on client side
    if (ret) return ret.split(this.TAG_SEP).sort();
    return [];
  }

  async set(photoId, tags, triggerSync = true) {
    // update the tags
    const ret = await this.client.hset(
      this.TAGGED,
      photoId,
      tags.join(this.TAG_SEP)
    );
    if (triggerSync) {
      this.triggerSync();
    }
    return ret;
  }

  async mget(photoIds) {
    if (!photoIds || !photoIds.length) return [];
    ptStoreLog("Getting tags for %d photos...", photoIds.length);
    const ret = await this.client.hmget(this.TAGGED, photoIds);
    ptStoreLog("Fetched tags for %d photos.", photoIds.length);
    return ret.map(x => {
      return x ? x.split(this.TAG_SEP).sort() : [];
    });
  }

  /**
   * Set tags for multiple photos.
   * Items can be either an array of photos
   *
   *   [[photo_id, tags], ...]
   *
   * or an object:
   *
   *   {
   *      photo_id1: tags1,
   *      photo_Id2: tags2
   *   }
   */
  async mset(obj, triggerSync = true) {
    const items = Array.isArray(obj) ? obj : [...Object.entries(obj)];
    const args = items
      .map(([photoId, tags]) => [photoId, tags.join(this.TAG_SEP)])
      .flat();
    const ret = await this.client.hmset(this.TAGGED, args);
    if (triggerSync) {
      this.triggerSync();
    }
    return ret === "OK";
  }

  async persist(dumpCSV = false) {
    if (dumpCSV) await this.dumpCSV();
    try {
      const ret = await this.client.bgsave();
      if (!ret) {
        ptStoreLog("Tags synced to disk.");
      }
    } catch (error) {
      ptStoreLog("Tag sync failed: %s", error);
    }
  }

  /**
   * Dump tagged photos (either all or from only one album)
   */
  dump(albumId, updateCounts = true) {
    return new Promise((resolve, reject) => {
      const tagged = {};
      const opts = { count: 1000 }; // batch size for hscan
      if (albumId && albumId !== ALBUM_ALL) {
        // pattern match
        opts.match = `${albumId}${ALBUM_DELIM}*`;
      }
      const hscan = this.client.hscanStream(this.TAGGED, opts);
      const taggedCounts = {}; // taggedPhotos counts by album
      // process the data
      hscan.on("data", data => {
        for (let i = 0; i < data.length; i += 2) {
          const key = data[i];
          const val = data[i + 1];
          tagged[key] = val ? val.split(this.TAG_SEP) : [];
          if (updateCounts) {
            const albId = key.split(ALBUM_DELIM)[0];
            // don't count empty list of tags
            if (tagged[key].length > 0) {
              taggedCounts[albId] = (taggedCounts[albId] || 0) + 1;
            }
          }
        }
      });
      hscan.on("end", () => {
        if (updateCounts) {
          this.client.hmset(this.COUNTS, taggedCounts).then(status => {
            ptStoreLog("Updated tagged photo counts, status: %s", status);
            resolve(tagged);
          });
        } else {
          resolve(tagged);
        }
      });
      hscan.on("error", reject);
    });
  }
}
