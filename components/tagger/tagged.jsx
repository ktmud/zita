import React, { useContext, useState, useRef } from "react";
import { setCookie } from "nookies";
import { Input, Tag, Table, Collapse, Button, Icon } from "antd";
import {
  downloadUrl,
  downloadFilename,
  PERSISTENT_COOKIE,
  imageUrl
} from "lib/client";
import { locById } from "lib/utils";
import { AppContext } from "components/context";
import CounterTag from "components/tagger/countertag";
import PhotoTooltip from "components/photoTooltip";

const { Panel } = Collapse;

function Tagged({ album, onAlbumUpdate, tagOptions }) {
  const { photos, current, tagged, totalPhotos, taggedPhotos } = album;
  const { cookies } = useContext(AppContext);

  // current list of tagged photos
  const showKbd = cookies.foldkbd !== "1" && taggedPhotos === 0;

  const KeyboardShortCuts = (
    <Panel className="help-text" header="Keyboard Shortcuts" key="kbd">
      <dl>
        <dt>
          <kbd>h</kbd>
          <kbd>k</kbd>
        </dt>
        <dd>Previous photo</dd>
        <dt>
          <kbd>l</kbd>
          <kbd>j</kbd>
        </dt>
        <dd>Next photo</dd>
        <dt>
          <kbd>[</kbd>
          <kbd>]</kbd>
        </dt>
        <dd>Previous or next 100 items</dd>
        <dt>
          <kbd>Alt + [</kbd>
        </dt>
        <dd>Previous album</dd>
        <dt>
          <kbd>Alt + ]</kbd>
        </dt>
        <dd>Next album</dd>
        <dt>
          <kbd>1</kbd>
          <kbd>2</kbd>
          {" ... "}
          <kbd>{Math.min(tagOptions.length, 9)}</kbd>
        </dt>
        <dd>Toggle tags</dd>
        <dt>
          <kbd>Backspace</kbd>
        </dt>
        <dd>Revert last unsaved operation</dd>
        <dt>
          <kbd>Space</kbd>
          <kbd>Enter</kbd>
        </dt>
        <dd>Save and next</dd>
      </dl>
      <p style={{ textAlign: "right", fontSize: "0.9em", margin: "16px 0 0" }}>
        Don&apos;t forget to disable{" "}
        <a
          href="https://chrome.google.com/webstore/detail/cvim/ihlenndgcmojhcghmfjfneahoeklbjjh?hl=en"
          target="_blank"
          rel="noopener noreferrer"
        >
          cVim
        </a>{" "}
        if you have it installed.
      </p>
    </Panel>
  );

  const onCollapseChange = activePanels => {
    if (!activePanels) return;
    if (activePanels.includes("kbd")) {
      setCookie(null, "foldkbd", "0", PERSISTENT_COOKIE);
    } else {
      setCookie(null, "foldkbd", "1", PERSISTENT_COOKIE);
    }
  };

  const onPhotoClick = photoId => {
    const photo = photos[current];
    if (photo) {
      // save but do not navigate to next
      photo.save(false);
    }
    onAlbumUpdate({ current: locById(photos, photoId) });
  };

  const [keyword, setKeyword] = useState("");

  const onSearch = (query, e) => {
    setKeyword(query);
    e.stopPropagation();
    e.preventDefault();
  };

  const onSearchBarClick = e => {
    e.stopPropagation();
  };

  const columns = [
    {
      title: "Photo",
      dataIndex: "id",
      key: "img",
      width: 76,
      render: (id, photo) => (
        <PhotoTooltip photo={photo}>
          <img
            alt={`${photo.id}`}
            src={imageUrl(photo.id)}
            style={{ width: 60, minHeight: 44.42 }}
          />
        </PhotoTooltip>
      )
    },
    {
      title: (
        <>
          Tags{" "}
          <Input.Search
            size="small"
            placeholder="Search"
            onClick={onSearchBarClick}
            onSearch={onSearch}
            style={{ width: 100, marginLeft: 16 }}
          />
        </>
      ),
      dataIndex: "tags",
      key: "tags",
      render: tags => (
        <span>
          {tags.map(tag => (
            <Tag color="green" key={tag}>
              {tag}
            </Tag>
          ))}
        </span>
      )
    }
  ];

  const format = (cookies.efmt || "cur-csv").split("-")[1];

  const panelHeader = (
    <>
      Tagged Photos{" "}
      <CounterTag taggedPhotos={taggedPhotos} totalPhotos={totalPhotos} />{" "}
      <Button
        key="down-album"
        size="small"
        className="download-album"
        title="Download tagged photos in current album"
        download={downloadFilename(album.id, format)}
        href={downloadUrl(album.id, format)}
        onClick={e => e.stopPropagation()}
      >
        <Icon type="cloud-download" />
      </Button>
    </>
  );

  const reKeyword = new RegExp(keyword, "i");
  const prevKeyword = useRef(keyword);
  const filteredData =
    keyword && tagged
      ? tagged.filter(x => reKeyword.test(`${x.tags.join(",")} ${x.id}`))
      : tagged;

  if (prevKeyword.current !== keyword && filteredData && filteredData[0]) {
    let firstTagged = null;
    for (let i = 0; i < photos.length; i += 1) {
      if (photos[i].id === filteredData[0].id) {
        firstTagged = i;
        break;
      }
    }
    onAlbumUpdate({ current: firstTagged });
    prevKeyword.current = keyword;
  }

  return (
    <Collapse
      accordion
      bordered={false}
      defaultActiveKey={showKbd ? ["kbd"] : ["tbl"]}
      onChange={onCollapseChange}
      className="tagged-items"
    >
      {KeyboardShortCuts}
      <Panel header={panelHeader} key="tbl">
        <Table
          size="small"
          dataSource={filteredData}
          rowKey="id"
          columns={columns}
          pagination={{ size: "small", pageSize: 5 }}
          onRow={record => {
            return {
              onClick() {
                onPhotoClick(record.id);
              }
            };
          }}
        />
      </Panel>
    </Collapse>
  );
}

export default Tagged;
