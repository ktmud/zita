/**
 * Header controls
 */
import React, { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  Slider,
  Menu,
  Icon,
  Dropdown,
  Pagination,
  Select,
  Tooltip,
  Tag,
  Row,
  Col,
  message
} from "antd";
import CounterTag from "components/tagger/countertag";
import SmoothProgress from "components/smoothProgress";
import debounce from "lodash.debounce";
import { fetchgql, PAGE_SIZE } from "lib/client";
import { tagColor } from "lib/utils";

const CHECK_INTERVAL = 2000;
const { Option } = Select;
const isCorrect = ({ tags, predTags }) => {
  return !tags || tags.length === 0 || tags.join(",") === predTags.join(",");
};
const pageSizeOptions = [
  "100",
  "200",
  "300",
  "400",
  "500"
  // "600",
  // "700",
  // "800",
  // "900",
  // "1000"
];

/**
 * Load more predictions
 */
const getPreds = async (photoIds, model) => {
  const GET_PREDS = `
    query GetPreds($photoIds: [String!]!, $model: String) {
      preds(photoIds: $photoIds, model: $model) {
        tags
      }
    }
  `;
  const data = await fetchgql(GET_PREDS, { photoIds, model });
  return data.preds.map(x => x.tags);
};

export default function PredictPageHeader({
  onPhotosUpdate,
  currentModel,
  album = {},
  photos = [],
  albums = [],
  modelOptions = []
}) {
  const router = useRouter();
  const { query } = router;
  const { albumId } = query;
  const ofset = parseInt(query.offset, 10) || 0;
  const pgSize = parseInt(query.limit, 10) || PAGE_SIZE;
  const imgSize = parseInt(query.imgsize, 10) || 1;
  const [pageSize, setPageSize] = useState(pgSize);
  const [imageSize, setImageSize] = useState(imgSize);

  // progress of asynchroneously loading predictions
  const [progress, noPredsList] = useMemo(() => {
    if (!albums) return 0;
    albums.forEach((a, i) => {
      const alb = a;
      alb.idx = i;
      alb.taggedPhotos = Math.min(alb.taggedPhotos, alb.totalPhotos);
    });
    if (!album) return 0;
    let numHasPred = 0;
    const nopreds = []; // photos with no preds
    photos.forEach((p, i) => {
      const photo = p;
      const hasPred = !!photo.predTags;
      if (hasPred) {
        numHasPred += 1;
      } else {
        nopreds.push([photo.id, i]);
      }
      photo.isCorrect = hasPred && isCorrect(photo);
      photo.hasPred = hasPred;
    });
    // in case percentage is NaN, `|| 0` prevents it
    // from showing as NaN or generating a "1%"
    return [numHasPred / photos.length || 0, nopreds];
  }, [album, albums, photos]);

  useEffect(() => {
    let tCheckProgress;
    let checkCount = 1;
    // perodically retry fetching predictions for photos without a prediction
    const checkProgress = () => {
      if (noPredsList.length > 0) {
        getPreds(noPredsList.map(x => x[0]), currentModel)
          .then(preds => {
            const newPhotosList = [...photos];
            let hasChanges = false;
            preds.forEach((predTags, i) => {
              if (predTags) {
                hasChanges = true;
                newPhotosList[noPredsList[i][1]].predTags = predTags;
              }
            });
            if (hasChanges) {
              onPhotosUpdate(newPhotosList);
            } else if (checkCount > 10) {
              const errorPhotos = [];
              errorPhotos.error = "Fetching predictions timed out!";
              onPhotosUpdate(errorPhotos);
            } else {
              tCheckProgress = setTimeout(checkProgress, CHECK_INTERVAL);
              checkCount += 1;
            }
          })
          .catch(error => {
            // display the error message for 5 seconds
            message.error(
              `Failed to load remaining photos: ${error.message}`,
              5
            );
          });
      }
    };
    tCheckProgress = setTimeout(checkProgress, CHECK_INTERVAL);
    return () => {
      clearTimeout(tCheckProgress);
    };
  }, [currentModel, noPredsList, onPhotosUpdate, photos]);

  const getRouterArgs = useCallback(
    (
      albId,
      {
        imgsize = imageSize,
        limit = pageSize,
        model = currentModel,
        offset = ofset,
        shallow
      } = {}
    ) => {
      const args = `?imgsize=${imgsize}&limit=${limit}&offset=${offset}&model=${model}`;
      const href = `/test/[albumId]${args}`;
      const as = `/test/${albId}${args}`;
      return [href, as, { shallow }];
    },
    [imageSize, pageSize, currentModel, ofset]
  );

  const updateUrl = debounce(
    useCallback(
      args => {
        router.replace(...getRouterArgs(albumId, args));
      },
      [albumId, getRouterArgs, router]
    ),
    500
  );

  const onImageSizeChange = imgsize => {
    setImageSize(imgsize);
    updateUrl({ imgsize, shallow: true });
  };

  const onPageSizeChange = limit => {
    setPageSize(() => {
      updateUrl({
        limit,
        // if loaded enough photos
        // no need to make another request
        shallow: photos.length > limit
      });
      return limit;
    });
  };

  const onModelChange = model => {
    updateUrl({ model });
  };

  const menu = (
    <Menu className="select-album">
      {albums.map(alb => {
        const [href, as] = getRouterArgs(alb.id);
        return (
          <Menu.Item key={alb.id}>
            <Link href={href} as={as}>
              <a href={as}>
                <span className="album-title">{alb.title} </span>
                <CounterTag
                  totalPhotos={alb.totalPhotos}
                  taggedPhotos={alb.taggedPhotos}
                />
              </a>
            </Link>
          </Menu.Item>
        );
      })}
    </Menu>
  );

  const numTotal = photos.length;
  const lstCanCompare = photos.filter(
    x => x.hasPred && x.tags && x.tags.length > 0
  );
  const lstCorrect = lstCanCompare.filter(x => x.isCorrect);
  const numCanCompare = lstCanCompare.length;
  const numCorrect = lstCorrect.length;
  const accuracy = numCorrect / numCanCompare;
  const showAcc = numCanCompare >= 50;

  return (
    <Row className="page-header">
      <Col span={9} className="page-header-title">
        <div className="ant-page-header-heading-title">
          <Dropdown overlay={menu}>
            <a href="." onClick={e => e.preventDefault()}>
              {album.title} <Icon type="down" />
            </a>
          </Dropdown>
        </div>
        <div className="page-header-counts">
          {/* <span className="untagged-count">{album.totalPhotos} photos</span> */}
          <div className="select-pred-model">
            <Select
              className=""
              value={currentModel}
              onChange={onModelChange}
              style={{
                width: 58 + Math.max(...modelOptions.map(x => x.length)) * 6
              }}
            >
              {modelOptions.map(m => (
                <Option key={m} value={m}>
                  {m}
                </Option>
              ))}
            </Select>
          </div>
          {showAcc ? (
            <div className="page-header-accuracy">
              <Tooltip title={`${numCorrect}/${numTotal} got all labels right`}>
                <Tag color={tagColor(accuracy)}>
                  ACC {(accuracy * 100).toFixed(1)}%
                </Tag>
              </Tooltip>
            </div>
          ) : null}
        </div>
      </Col>
      <Col span={15} className="page-header-controls">
        <div className="page-header-progress">
          <SmoothProgress
            key="preds-progress"
            percent={Math.round(progress * 100)}
            status="active"
            duration={CHECK_INTERVAL}
          />
        </div>
        <div className="page-header-pagination">
          <Pagination
            current={Math.ceil((ofset + 1) / pageSize)}
            total={album.totalPhotos}
            onChange={(p, pSize) =>
              updateUrl({
                imgsize: imageSize,
                limit: pageSize,
                offset: (p - 1) * pSize
              })
            }
            hideOnSinglePage
            size="small"
            showLessItems
            pageSize={pageSize}
            pageSizeOptions={pageSizeOptions}
            showSizeChanger
            onShowSizeChange={(current, size) => onPageSizeChange(size)}
          />
        </div>
        <div span={6} className="page-header-image-size">
          Image Size
          <Slider
            min={1}
            max={4}
            step={1}
            tipFormatter={x => `${x}x`}
            onChange={onImageSizeChange}
            value={imageSize}
          />
          <span>{imageSize}x</span>
        </div>
      </Col>
    </Row>
  );
}
