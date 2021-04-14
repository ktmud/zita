import Debug from "debug";
import store from "server/store";
import { downloadFilename } from "lib/client";

const ptDebug = Debug("ZT.export");

/**
 * Export photo tags as csv or json.
 */
export default (req, res) => {
  const {
    query: { filename }
  } = req;
  const [albumId, format] = filename.split(".");
  store
    .export(albumId, format)
    .then(content => {
      res.setHeader("Content-Type", `text/plain; charset=utf-8`);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${downloadFilename(albumId, format)}"`
      );
      res.statusCode = 200;
      res.send(content);
    })
    .catch(error => {
      ptDebug("Failed to export: ", error);
      res.statusCode = 500;
      res.end();
    });
};
