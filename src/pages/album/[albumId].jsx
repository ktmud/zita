import React, { useMemo, useState, useCallback } from "react";
import Router, { useRouter } from "next/router";

import Tagger from "components/tagger/tagger";
import AlbumTabs from "components/albumTabs";
import { fetchgql } from "lib/client";
import { firstUntagged } from "lib/utils";

function AlbumHome({ albums, start, tagOptions }) {
  const router = useRouter();
  const { albumId } = router.query;

  // a map for getting album by id, also add `idx` to each album at the same time
  const albumsCache = useMemo(() => {
    const cache = {};
    albums.forEach((a, i) => {
      const alb = a;
      alb.idx = i;
      alb.taggedPhotos = Math.min(alb.taggedPhotos, alb.totalPhotos);
      cache[alb.id] = alb;
    });
    return cache;
  }, [albums]);

  const selectAlbum = (newAlbumId) => {
    // switch to the new album
    const alb = albumsCache[newAlbumId];
    const href = `/album/[albumId]`;
    const as = `/album/${newAlbumId}`;
    // shallow: true means not to call `getInitialProps` again
    router.replace(href, as, { shallow: true });
    return alb;
  };

  const album = albumsCache[albumId];
  const { photos, totalPhotos } = album;
  const setStateTrigger = useState(true)[1];

  // if album's current photo is not set
  if (album.current == null) {
    if (start) {
      album.current = start - 1;
    } else {
      album.current = firstUntagged(photos, totalPhotos);
    }
  }

  // list all tagged photos if haven't been processed
  album.tagged = useMemo(
    () => photos && photos.filter((x) => x && x.tags.length > 0),
    [photos]
  );
  if (album.taggedPhotos > album.total) {
    if (album.tagged) {
      album.taggedPhotos = album.tagged.length;
    } else if (album.taggedPhotos < totalPhotos) {
      album.taggedPhotos = totalPhotos;
    }
  }

  // the child can only update either the current photo index,
  // of the photos list (by fetchMore or change tags)
  const onAlbumUpdate = useCallback(
    (alb, photo) => {
      let hasChanges = false;
      if (alb) {
        [
          "current",
          "taggers",
          "totalPhotos",
          "taggedPhotos",
          "photos",
          "tagged",
        ].forEach((key) => {
          if (key in alb && alb[key] !== album[key]) {
            // console.log(key, alb[key]);
            album[key] = alb[key];
            hasChanges = true;
          }
        });
      }
      if (photo) {
        photos[photo.idx] = photo;
        hasChanges = true;
      }
      // trigger a renrender
      if (hasChanges) {
        setStateTrigger((prev) => !prev);
      }
    },
    [album, photos, setStateTrigger]
  );

  return (
    <div className="container">
      <AlbumTabs albums={albums} album={album} selectAlbum={selectAlbum} />
      <Tagger
        album={album}
        onAlbumUpdate={onAlbumUpdate}
        tagOptions={tagOptions}
      />
    </div>
  );
}

AlbumHome.getInitialProps = async (ctx) => {
  const { query, res } = ctx;
  const currentAlbumId = query.albumId;
  // initial current photo, 1 based index
  const start = parseInt(query.start, 10);
  const data = await fetchgql(
    `{
    tagOptions
    # Take all albums
    albums(limit: -1) {
      id
      title
      taggedPhotos
      totalPhotos
    }
    album(id: "${currentAlbumId}", loadAllTagged: true) {
      id
      taggers
      photos(limit: ${start ? start + 100 : 100}) {
        id
        size
        tags
      }
    }
   }`,
    null,
    { ctx }
  );

  // if could not find current album from albums, redirect to home page
  // home will find next available album or show 404
  if (!data.albums.find((x) => x.id === currentAlbumId)) {
    const loc = "/";
    if (res) {
      res.writeHead(302, {
        Location: loc,
      });
      res.end();
    } else {
      Router.replace(loc);
    }
    return data;
  }
  const curAlbum = data.album;
  if (curAlbum) {
    for (let i = 0; i < data.albums.length; i += 1) {
      const alb = data.albums[i];
      if (alb.id === curAlbum.id) {
        alb.taggers = curAlbum.taggers;
        alb.photos = curAlbum.photos;
        break;
      }
    }
  }
  data.start = start;
  return {
    start: data.start,
    albums: data.albums,
    tagOptions: data.tagOptions,
  };
};

AlbumHome.pageName = "Label Truth";
export default AlbumHome;
