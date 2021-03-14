import Debug from "debug";
import fs, { writeFileSync } from "fs";
import { ALBUM_ALL } from "lib/client";
import { ALBUM_DELIM, LABELS_CSV } from "server/settings";

const ptStoreLog = Debug("ZT.store.fs");

// function sleep(millis) {
//   return new Promise(resolve => setTimeout(resolve, millis));
// }

/**
 * Save tagged photos to a JSON file
 */
export default class FileStore {
  // time before removing user from active taggers list
  // default: 10min
  TAGGING_TIMEOUT = 600000;

  TAG_SEP = "||";

  CSV_COL_DELIM = ",";

  CSV_ROW_DELIM = "\n";

  syncTimer = null;

  SYNC_WAIT = 15000; // wait for 15 sec before dumping tags data to disk

  constructor(output = LABELS_CSV) {
    this.init(output);
  }

  init(output) {
    ptStoreLog("Init with FileStore", output);
    this.output = output;
    // file extension indicate file format
    this.format = output
      .split(".")
      .pop()
      .toLowerCase();
    this.prevOutput = "";
    this.taggedCounts = {};
    this.taggers = {}; // album's taggers list
    this.tagged = {};
    this.load().then(tagged => {
      if (tagged) {
        this.tagged = tagged;
        ptStoreLog("Loaded existing tags.");
        // update album tagged photos counter
        Object.keys(tagged).forEach(x => {
          if (tagged[x] && tagged[x].length > 0) {
            this.incr(this.albumId(x));
          }
        });
      }
    });
  }

  /**
   * Get album id from photo id
   */
  // eslint-disable-next-line class-methods-use-this
  albumId(photoId) {
    return photoId.split(ALBUM_DELIM, 2)[0];
  }

  async get(photoId) {
    return this.tagged[photoId] || [];
  }

  async set(photoId, tags, triggerSync = true) {
    this.tagged[photoId] = tags;
    if (triggerSync) {
      this.triggerSync();
    }
  }

  async mset(items) {
    items.forEach(([photoId, tags]) => {
      this.set(photoId, tags, false);
    });
    this.triggerSync();
  }

  /**
   * Tag one photo with tags or return existing tags
   */
  async tag(photoId, tags, ztuid = null) {
    // await sleep(500);
    const albumId = this.albumId(photoId);
    const prevTags = await this.get(photoId);
    await this.set(photoId, tags);

    let incr = 0;
    if (prevTags.length === 0 && tags.length > 0) {
      incr = 1;
    }
    if (prevTags.length > 0 && tags.length === 0) {
      incr = -1;
    }
    if (ztuid) {
      // announce this users is tagging this album
      const ret = await this.setTagger(albumId, ztuid);
      // 0: exist and updated
      // 1: created
      if (ret !== 0 && ret !== 1) {
        throw new Error("setting tagger failed");
      }
    }
    if (incr) {
      // update the tagged photos counter
      await this.incr(albumId, incr);
    }
    return [prevTags, incr];
  }

  triggerSync() {
    if (this.syncTimer !== null) {
      clearTimeout(this.syncTimer);
    }
    this.syncTimer = setTimeout(() => {
      this.persist(true);
    }, this.SYNC_WAIT);
  }

  /**
   * Query how many users are tagging the same album
   * @param {String} albumId - which album to query
   * @param {String} ztuid - which user is querying this
   *    (who will be added to current list of active users)
   */
  async taggersCount(albumId, ztuid) {
    // await sleep(1000);
    let taggers = [...Object.keys(this.taggers[albumId] || {})];
    if (ztuid) {
      taggers = taggers.filter(x => x !== ztuid);
    }
    return taggers.length;
  }

  /**
   * Add ztuid to albumId's taggers list
   */
  async setTagger(albumId, ztuid) {
    let ret = 0;
    if (!(albumId in this.taggers)) {
      this.taggers[albumId] = {};
      ret = 1;
    }
    // an album's taggers, with key being tagger id,
    // value being a timer to delete this tagger
    const taggers = this.taggers[albumId];
    const tid = taggers[ztuid];
    if (tid) clearTimeout(tid);
    taggers[ztuid] = setTimeout(() => {
      delete taggers[ztuid];
    }, this.TAGGING_TIMEOUT);
    return ret;
  }

  /**
   * Increment tag counts for an album
   */
  async incr(albumId, stepSize = 1) {
    const { taggedCounts } = this;
    if (!stepSize) return;
    if (!(albumId in taggedCounts)) {
      taggedCounts[albumId] = 0;
    }
    taggedCounts[albumId] += stepSize;
  }

  async taggedCount(albumId) {
    return this.taggedCounts[albumId] || 0;
  }

  async mget(photoIds) {
    return photoIds.map(x => this.tagged[x] || []);
  }

  /**
   * Save the tags to the output
   */
  async persist(dumpCSV) {
    const newOutput = await this.export();
    if (newOutput !== this.prevOutput) {
      // must assign ret (event though there's no return value)
      // otherwise process will not wait;
      writeFileSync(this.output, newOutput);
      this.prevOutput = newOutput;
      ptStoreLog("Tags synced to %s", this.output);
      if (dumpCSV && this.output !== LABELS_CSV) {
        this.dumpCSV();
      }
      return true;
    }
    return false;
  }

  async dumpCSV(output = LABELS_CSV) {
    const content = await this.export(null, "csv");
    writeFileSync(output, content);
    ptStoreLog("Tags written to %s", output);
  }

  async dump(albumId) {
    if (albumId && albumId !== ALBUM_ALL) {
      const ret = {};
      Object.entries(this.tagged).forEach(([key, val]) => {
        if (key.indexOf(albumId + ALBUM_DELIM) === 0) {
          ret[key] = val;
        }
      });
      return ret;
    }
    return this.tagged;
  }

  /**
   * Export `tagged` map to a JSON string or CSV file
   */
  async export(albumId = null, format_ = null) {
    const tagged = await this.dump(albumId);
    const format = format_ || this.format;
    if (format === "csv")
      return Object.entries(tagged)
        .map(([key, val]) => {
          return [key, val.join(this.TAG_SEP)].join(this.CSV_COL_DELIM);
        })
        .join(this.CSV_ROW_DELIM);
    return JSON.stringify(tagged, null, 2);
  }

  parseCSV(content) {
    const ret = {};
    content.split(this.CSV_ROW_DELIM).forEach(line => {
      const [key, val] = line.split(this.CSV_COL_DELIM, 2);
      if (key && val) {
        ret[key] = val.split(this.TAG_SEP);
      }
    });
    return ret;
  }

  /**
   * Load existing tags
   */
  async load(output_) {
    const output = this.output || output_;
    if (!fs.existsSync(output)) return null;

    ptStoreLog("Reading existing tags from %s...", output);
    const outputContent = fs.readFileSync(output, { encoding: "utf-8" });

    // if empty, stop
    if (!outputContent) return null;

    let prevTagged;
    try {
      if (output.endsWith(".json")) {
        prevTagged = JSON.parse(outputContent);
      } else {
        prevTagged = this.parseCSV(outputContent);
      }
    } catch (err) {
      if (err instanceof SyntaxError) {
        ptStoreLog("Failed to load tags: ", err.message);
        ptStoreLog(outputContent);
      } else {
        throw err;
      }
    }
    return prevTagged;
  }
}
