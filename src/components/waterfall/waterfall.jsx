/* eslint-disable react/no-array-index-key */
/* eslint-disable no-param-reassign */
import React, { useMemo, useEffect } from "react";
import { Row, Col } from "antd";
import StackGrid, { transitions } from "react-stack-grid";
import Link from "next/link";
import { imageUrl } from "lib/client";
import PhotoTooltip from "components/photoTooltip";
import PhotoTagsDiff from "components/photoTagsDiff";
import CounterTag from "components/tagger/countertag";

const { scaleDown: trans } = transitions;

// const PIXEL =
//   "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

// function LazyImage({ src: realSrc, alt, lazy }) {
//   const [src, setSrc] = useState(lazy ? PIXEL : realSrc);
//   useEffect(() => {
//     const tLoad = setTimeout(() => {
//       if (lazy) {
//         setSrc(realSrc);
//       }
//     }, Math.random() * 1000);
//     return () => {
//       clearTimeout(tLoad);
//     };
//   });
//   return <img src={src} alt={alt} />;
// }

function Waterfall({ album, photos, itemSize = 1 }) {
  const { id: albumId } = album;
  const photosByTag = useMemo(() => {
    const cache = {};
    photos.forEach(photo => {
      (photo.predTags || []).forEach(tag => {
        cache[tag] = cache[tag] || [];
        cache[tag].push(photo);
      });
    });
    Object.entries(cache).forEach(([key, val]) => {
      cache[key] = val.sort((a, b) => {
        // move incorrect items to the front
        if (!a.isCorrect && b.isCorrect) return -1;
        return 0;
      });
    });
    return cache;
  }, [photos]);

  const gutterSize = 16;
  const tagOpts = Object.keys(photosByTag);
  const tagCount = tagOpts.length;
  // [[tag, photos], [tag, photos], ...]
  const tagPhotos = tagOpts
    .map(tag => {
      // tag, totalCount, correctCount
      const phts = photosByTag[tag] || [];
      return [tag, phts.length, phts.filter(x => x.isCorrect).length];
    })
    .sort((a, b) => b[1] - a[1]);
  const tagPhotoCounts = tagPhotos.map(x => x[1]);
  const maxCount = Math.max(...tagPhotoCounts);

  const getColSpan = total => {
    // at most 6 cols at the minimal imageSize
    return Math.max(3, Math.min(6, Math.floor(24 / total)) * itemSize);
  };
  const getColWidth = (span, total) => {
    let ret = 1;
    if (itemSize === 1) {
      if (span > 5) {
        ret = 0.25;
      } else if (span > 4) {
        ret = 1 / 3;
      } else if (span > 2) {
        ret = 0.5;
      }
    } else if (itemSize === 2) {
      if (span > 8) {
        ret = 0.25;
      } else if (span > 6) {
        ret = 1 / 3;
      } else if (span > 3) {
        ret = 0.5;
      }
    } else if (itemSize === 3) {
      if (span > 10) {
        ret = 0.25;
      } else if (span > 6) {
        ret = 1 / 3;
      } else if (span > 4) {
        ret = 0.5;
      }
    } else if (itemSize === 4) {
      if (span > 20) {
        ret = 0.25;
      } else if (span > 8) {
        ret = 1 / 3;
      } else if (span > 6) {
        ret = 0.5;
      }
    }
    if (maxCount < 3 && total < 3) ret = Math.max(0.5, ret);
    if (maxCount < 2 && total < 2) ret = 1;
    return ret;
  };
  // default column width and item width
  const colSpan = getColSpan(tagCount);

  const getColSize = idx => {
    let span;
    if (tagPhotoCounts[idx] === maxCount) {
      // the most popular tag takes all the remaining colspans
      span = colSpan + (colSpan * tagCount < 24 ? 24 % tagCount : 24 % colSpan);
    } else {
      span = colSpan;
    }
    return [span, getColWidth(span, tagPhotoCounts[idx] || 0)];
  };

  const refs = [];
  useEffect(() => {
    const timeouts = refs.map(ref => {
      const run = () => {
        if (ref.grid) {
          ref.updateLayout();
        }
      };
      // all timeouts for this grid
      const ret = [];
      // based on number of items in grid, wait different time
      // before relayout
      const numChild = ref.props.children.length;
      if (numChild < 2) return ret;

      const initial = 600 + 10 * numChild;
      ret.push(setTimeout(run.bind(this, 1), initial));
      // ret.push(setTimeout(run.bind(this, 2), initial + 1600));
      // if (initial >= 800) {
      //   ret.push(setTimeout(run.bind(this, 3), initial + 5000));
      // }
      return ret;
    });
    return () => {
      timeouts.flat().forEach(clearTimeout);
    };
  }, [refs]);
  const showTags = (span, width) => {
    // show photo tags as long as the image takes
    // at least 3 columns
    return span * width > 2;
  };

  return (
    <Row className="waterfall" gutter={gutterSize}>
      {tagPhotos.length === 0
        ? [...Array(3)].map((_, i) => (
            <Col key={`col-${i}`} span={4}>
              <h2 className="placeholder"> </h2>
              <StackGrid
                className="waterfall-strip"
                gutterWidth={2}
                gutterHeight={2}
                columnWidth="50%"
                key="placeholder-strip"
              >
                {[...Array(12 - 4 * i)].map((__, j) => (
                  <div
                    key={`placeholder-${j}`}
                    className="animated-placeholder"
                  />
                ))}
              </StackGrid>
            </Col>
          ))
        : tagPhotos.map(([opt, numTotal, numCorrect], idx) => {
            if (!photosByTag[opt]) return null;
            const [span, width] = getColSize(idx);
            return (
              <Col span={span} key={opt}>
                <h2>
                  {opt}
                  <CounterTag
                    totalPhotos={numTotal}
                    taggedPhotos={numCorrect}
                  />
                </h2>
                <StackGrid
                  ref={cur => refs.push(cur)}
                  className="waterfall-strip"
                  columnWidth={`${width * 100}%`}
                  gutterWidth={2}
                  gutterHeight={2}
                  monitorImagesLoaded={false}
                  // easing={easings.easeInOut}
                  appear={trans.appear}
                  appeared={trans.appeared}
                  enter={trans.enter}
                  entered={trans.entered}
                  leaved={trans.leaved}
                  key={opt}
                >
                  {photosByTag[opt].map(photo => {
                    const href = `/album/[albumId]?start=${photo.idx + 1}`;
                    const as = `/album/${albumId}?start=${photo.idx + 1}`;
                    return (
                      <Link key={photo.id} href={href} as={as}>
                        <a
                          href={as}
                          className={`waterfall-item ${
                            photo.isCorrect ? "" : "wrong-prediction"
                          } ${showTags(span, width) ? "with-tags" : ""}`}
                        >
                          {showTags(span, width) ? (
                            <>
                              <img src={imageUrl(photo.id)} alt="" />
                              <PhotoTagsDiff photo={photo} />
                            </>
                          ) : (
                            <PhotoTooltip
                              overlayClassName="waterfall-item-tooltip"
                              mouseEnterDelay={0.1}
                              width={320}
                              photo={photo}
                              placement="bottom"
                              showTags
                              showPredTags
                            >
                              <img src={imageUrl(photo.id)} alt="" />
                            </PhotoTooltip>
                          )}
                        </a>
                      </Link>
                    );
                  })}
                </StackGrid>
              </Col>
            );
          })}
    </Row>
  );
}

export default Waterfall;
