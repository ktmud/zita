import Debug from "debug";
import fetch from "isomorphic-unfetch";
import { parseCookies } from "nookies";
import { GQL_ROOT, CLIENT_API_ROOT } from "server/settings";

const ptDebug = Debug("ZT.client");

export const ALBUM_ALL = "__all__";
export const ZT_UID = "ZT_U";
export const ZT_MODEL = "ZT_M";
export const PERSISTENT_COOKIE = { maxAge: 365 * 60 * 60 * 24, path: "/" };

export const imageUrl = id => {
  return `${CLIENT_API_ROOT}/photo/${id}`;
};

export const downloadUrl = (albumId, format) => {
  return `${CLIENT_API_ROOT}/export/${albumId}.${format}`;
};

export const downloadFilename = (albumId, format) => {
  if (albumId === ALBUM_ALL) {
    return `photo-tags.${format}`;
  }
  return `photo-tags-${albumId}.${format}`;
};

export const fetchgql = async (
  query,
  variables,
  { ctx, headers, cookies: cookies_, apiRoot = GQL_ROOT } = {}
) => {
  const cookies = cookies_ || parseCookies(ctx);
  const queryText = typeof query === "string" ? query : query.loc.source.body;
  const response = await fetch(apiRoot, {
    method: "POST",
    headers: {
      [`X-${ZT_UID}`]: cookies[ZT_UID],
      "Content-type": "application/json",
      ...headers
    },
    body: JSON.stringify({ query: queryText, variables })
  });
  const { data, errors } = await response.json();
  if (errors) {
    ptDebug(errors[0], errors[0].extensions.exception);
    throw new Error(errors[0].message);
  }
  return data;
};

/**
 * Pick the next album that has no one tagging.
 * If all albums are occupied, return a random album.
 */
export const nextAvailAlbum = async (ctx, checkTaggers = true) => {
  // fetch all available albums first
  const bs = await fetchgql(
    `{
      albums(limit: ${checkTaggers ? -1 : 1}) {
        id
        taggers
        taggedPhotos
        totalPhotos
      }
    }`,
    null,
    ctx
  );
  // find the first album without a tagger
  let idx = 0;
  if (checkTaggers) {
    while (idx < bs.albums.length) {
      const alb = bs.albums[idx];
      if (!alb.taggers && alb.taggedPhotos < alb.totalPhotos) break;
      idx += 1;
    }
    // if nothing found, return a random album
    if (idx === bs.albums.length) {
      idx = Math.floor(Math.random() * bs.albums.length);
    }
  }
  return bs.albums[idx].id;
};

export const PAGE_SIZE = 100;

const GET_ALBUM = `
  query GetAlbum(
    $albumId: String!,
    $limit: Int = ${PAGE_SIZE},
    $offset: Int = 0
  ) {
    album(id: $albumId) {
      id
      totalPhotos
      taggedPhotos
      taggers
      photos(limit: $limit, offset: $offset) {
        id
        size
        tags
      }
    }
  }
`;

/**
 * Fetch more photos
 */
export function fetchPhotos(args) {
  return fetchgql(GET_ALBUM, args);
}
