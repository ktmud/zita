import Debug from "debug";
import zmq from "zeromq";

const ptDebug = Debug("ZT.RPC");
const EMPTY_FUNC = () => {};
const RPC_TIMEOUT = 120000;

export default class RPCBackend {
  type = "RPC";

  constructor({ url, model }) {
    // API endpoint
    this.url = url;
    this.model = model;
  }

  setModel(model) {
    this.model = model || "";
  }

  async query(query_) {
    if (this.model === undefined || this.model === null) {
      throw Error("Must setModel before asking for predictions");
    }

    const query = { model: this.model, ...query_ };
    let resolve = EMPTY_FUNC;
    let reject = EMPTY_FUNC;

    // ptDebug("Connecting to RPC socket %s ...", this.url);
    const socket = zmq.socket("req");
    socket.connect(this.url);

    socket.on("message", res => {
      const result = JSON.parse(res);
      if (result && result.error) {
        reject(result.error);
      } else {
        resolve(result);
      }
      socket.close();
    });
    socket.on("error", error => {
      reject(error);
      socket.close();
    });
    socket.send(JSON.stringify(query));

    return new Promise((resolve_, reject_) => {
      const tReject = setTimeout(() => {
        reject_(new Error("Loading predictions timed out."));
        socket.close();
      }, RPC_TIMEOUT);
      resolve = data => {
        resolve_(data);
        clearTimeout(tReject);
      };
      reject = error => {
        reject_(error);
        clearTimeout(tReject);
      };
    });
  }

  /**
   * Predict photo tags for one photo
   */
  predict(photoId, { tagsOnly = true } = {}) {
    // return may be null, which means it hasn't been cached
    const ret = this.query({ photoId, tagsOnly });
    return ret ? ret.sort() : ret;
  }

  async predictBatch(photoIds, { tagsOnly = true } = {}) {
    if (!photoIds || photoIds.length === 0) {
      return [];
    }
    // ptDebug("Ask predictions for %s photos...", photoIds.length);
    const predictions = await this.query({ photoIds, tagsOnly });
    ptDebug(
      "Fetched predictions for %s photos.",
      predictions.filter(x => x && x.length > 0).length
    );
    // always sort the tags
    return predictions.map(x => (x ? x.sort() : x));
  }
}
