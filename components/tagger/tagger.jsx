import React, { useContext } from "react";
import { Row, Col, PageHeader, Menu, Dropdown, Icon, Tooltip } from "antd";
import { setCookie } from "nookies";
import {
  ALBUM_ALL,
  downloadUrl,
  downloadFilename,
  PERSISTENT_COOKIE
} from "lib/client";
import { AppContext } from "components/context";
import Tagging from "./tagging";
import Tagged from "./tagged";

function Tagger({ album, onAlbumUpdate, tagOptions }) {
  const { totalPhotos, taggedPhotos, taggers } = album;
  const { cookies } = useContext(AppContext);

  const onChangeExportFormat = ({ key: efmt }) => {
    // remember the preferred download format
    cookies.efmt = efmt;
    setCookie(null, "efmt", efmt, PERSISTENT_COOKIE);
  };

  const selectExportFormat = (
    <Menu onClick={onChangeExportFormat}>
      {[
        ["all", "csv", "__all__", "All Albums CSV"],
        ["all", "json", "__all__", "All Albums JSON"],
        ["cur", "csv", album.id, "Current Album CSV"],
        ["cur", "json", album.id, "Current Album JSON"]
      ].map(([target, format, targetname, name]) => {
        return (
          <Menu.Item key={`${target}-${format}`}>
            <a
              href={downloadUrl(targetname, format)}
              download={downloadFilename(targetname, format)}
            >
              {name}
            </a>
          </Menu.Item>
        );
      })}
    </Menu>
  );

  const onDownloadClick = e => {
    e.stopPropagation();
    const elem = document.createElement("a");
    const [target, format] = (cookies.efmt || "all-csv").split("-");
    const targetname = target === "all" ? ALBUM_ALL : album.id;
    elem.target = "_blank";
    elem.href = downloadUrl(targetname, format || "csv");
    elem.download = downloadFilename(targetname, format || "csv");
    elem.click();
  };

  return (
    <>
      <PageHeader
        backIcon={false}
        title={<span>{album.title}</span>}
        subTitle={
          <div className="page-header-counts">
            <Tooltip title={<>{totalPhotos - taggedPhotos} untagged photos</>}>
              <span className="untagged-count">
                <Icon type="picture" />
                {totalPhotos - taggedPhotos}
              </span>
            </Tooltip>{" "}
            {taggers ? (
              <Tooltip
                title={
                  <>
                    <strong>{taggers}</strong> other active
                    {taggers > 1 ? " taggers " : " tagger "}
                  </>
                }
              >
                <span className="taggers-count">
                  <Icon type="user" />
                  {taggers}
                </span>
              </Tooltip>
            ) : null}
          </div>
        }
        extra={[
          <Dropdown.Button
            key="down-all"
            trigger={["hover"]}
            overlay={selectExportFormat}
            icon={<Icon type="down" />}
            onClick={onDownloadClick}
          >
            <Icon type="download" />
            Download Tags
          </Dropdown.Button>
        ]}
      />
      <div className="main">
        <Row type="flex" justify="center" gutter={24}>
          <Col span={16} xs={24} sm={24} md={24} lg={16}>
            <Tagging
              album={album}
              tagOptions={tagOptions}
              onAlbumUpdate={onAlbumUpdate}
            />
          </Col>
          <Col span={8} xs={24} sm={24} md={24} lg={8}>
            <Tagged
              album={album}
              tagOptions={tagOptions}
              onAlbumUpdate={onAlbumUpdate}
            />
          </Col>
        </Row>
      </div>
    </>
  );
}

export default Tagger;
