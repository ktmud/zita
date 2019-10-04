import path from "path";
import send from "send";
import { ALBUMS_ROOT, ALBUM_DELIM } from "server/settings";

/**
 * Return the photo JPEG response
 */
export default (req, res) => {
  const {
    query: { photoId }
  } = req;
  const photoPath = path.join(ALBUMS_ROOT, photoId.replace(ALBUM_DELIM, "/"));
  send(req, photoPath).pipe(res);
};
