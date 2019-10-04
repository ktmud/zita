import React from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { Tabs } from "antd";
import CounterTag from "components/tagger/countertag";
import "./albumTabs.less";

const { TabPane } = Tabs;

function AlbumTabs({ albums, album, selectAlbum, section = "album" }) {
  // a map for getting album by id, also add `idx` to each album at the same time

  const selectAlbumByIdx = i => {
    let idx = i;
    if (idx >= albums.length) {
      idx -= albums.length;
    } else if (idx < 0) {
      idx += albums.length;
    }
    return selectAlbum(albums[idx].id);
  };

  useHotkeys(
    "alt+[,alt+]",
    (event, handler) => {
      switch (handler.key) {
        case "alt+[":
          selectAlbumByIdx(album.idx - 1);
          break;
        case "alt+]":
          selectAlbumByIdx(album.idx + 1);
          break;
        default:
          break;
      }
    },
    [album.idx]
  );

  const AlbumTab = a => {
    const alb = albums[a.idx] || a; // use cache when possible
    return (
      <TabPane
        key={alb.id}
        tab={
          <a
            href={`/${section}/${alb.id}`}
            title={`${alb.taggedPhotos} of ${alb.totalPhotos} photos tagged`}
            onClick={e => e.preventDefault()}
          >
            {alb.id}
            <CounterTag
              totalPhotos={alb.totalPhotos}
              taggedPhotos={alb.taggedPhotos}
            />
          </a>
        }
      />
    );
  };

  return (
    <Tabs
      className="album-switcher"
      key="albumSwitch"
      activeKey={album.id}
      onChange={selectAlbum}
      animated={false}
      size="small"
    >
      {albums.map(AlbumTab)}
    </Tabs>
  );
}

export default AlbumTabs;
