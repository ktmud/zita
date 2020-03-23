import React, { useState, useEffect } from "react";
import Router, { useRouter } from "next/router";
import { Alert } from "antd";

import Waterfall from "components/waterfall/waterfall";
import { fetchgql, PAGE_SIZE } from "lib/client";
import PredictPageHeader from "./header";

function AlbumHome({ error, albums, album = {}, modelOptions, currentModel }) {
  const router = useRouter();
  const { query } = router;
  const pgSize = parseInt(query.limit, 10) || PAGE_SIZE;
  const imgSize = parseInt(query.imgsize, 10) || 1;
  const [photos, setPhotos] = useState(album.photos);

  // whenever `album` object updates, update photos
  useEffect(() => {
    setPhotos(album.photos);
  }, [album.photos]);

  return (
    <div className="preds container">
      {album && albums ? (
        <>
          <PredictPageHeader
            albums={albums}
            album={album}
            photos={photos.error ? [] : photos}
            onPhotosUpdate={setPhotos}
            modelOptions={modelOptions}
            currentModel={currentModel}
          />
          <div className="main">
            {photos.error ? (
              <Alert
                message="Error"
                description={photos.error}
                type="error"
                showIcon
              />
            ) : (
              <Waterfall
                album={album}
                photos={photos.slice(0, pgSize)}
                itemSize={imgSize}
              />
            )}
          </div>
        </>
      ) : (
        <Alert message="Error" description={error} type="error" showIcon />
      )}
    </div>
  );
}

AlbumHome.getInitialProps = async ctx => {
  const { query, res } = ctx;
  const currentAlbumId = query.albumId;
  // initial current photo
  const offset = parseInt(query.offset, 10) || 0;
  const pageSize = parseInt(query.limit, 10) || PAGE_SIZE;
  const imageSize = parseInt(query.imgsize, 10) || 1;
  // default model is empty string, which will then defaults
  // to first model in the model options list
  const { model = "" } = query;

  const GET_PREDS = `{
    modelOptions
    defaultModel
    # Take all albums
    albums(limit: -1) {
      id
      title
      taggedPhotos
      totalPhotos
    }
    album(id: "${currentAlbumId}", loadAllTagged: true) {
      id
      title
      totalPhotos
      taggedPhotos
      taggers
      photos(offset: ${offset}, limit: ${pageSize}) {
        id
        idx
        size
        tags
        predTags(model: "${model}")
      }
    }
  }`;

  let data;
  try {
    data = await fetchgql(GET_PREDS, null, { ctx });
  } catch (err) {
    return { error: err.message };
  }
  if (data.modelOptions.length === 0) {
    return { error: "No models found in MODELS_ROOT" };
  }
  const { album, albums, defaultModel, modelOptions } = data;
  const currentModel = model || defaultModel;

  // if could not find current album from albums, redirect to home page
  // home will find next available album or show 404
  if (!album || (model && !modelOptions.includes(model))) {
    let params = new URLSearchParams();
    Object.entries(query).forEach(([key, val]) => {
      if (key !== "model") {
        params.append(key, val);
      }
    });
    params = params ? `?${params.toString()}` : "";
    const href = album ? `/test/[albumId]${params}` : `/test`;
    const as = album ? `/test/${album.id}${params}` : `/test`;
    if (res) {
      res.writeHead(302, {
        Location: href
      });
      res.end();
    } else {
      Router.replace(href, as);
    }
    return data;
  }

  // const { album } = data;
  // if (album) {
  //   // extend current album in the albums list
  //   for (let i = 0; i < data.albums.length; i += 1) {
  //     const alb = data.albums[i];
  //     if (alb.id === album.id) {
  //       alb.taggers = album.taggers;
  //       alb.photos = album.photos;
  //       break;
  //     }
  //   }
  // }
  return {
    imageSize,
    pageSize,
    album,
    albums,
    currentModel,
    modelOptions
  };
};

AlbumHome.pageName = "Test Predictions";
export default AlbumHome;
