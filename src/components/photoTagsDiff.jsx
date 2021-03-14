import React from "react";
import { Tag } from "antd";

export default function PhotoTagsDiff({
  photo,
  showPredTags = true,
  showTags = true
}) {
  const isCorrect =
    (photo.predTags && photo.predTags.join(",")) ===
    (photo.tags && photo.tags.join(","));
  const showTrueTags = showTags && photo.tags && photo.tags.length > 0;
  return (
    <div className="photo-tags-diff">
      {showTrueTags ? (
        <div className="true-tags">
          {isCorrect ? null : <strong>True</strong>}
          {photo.tags.map(item => {
            const color =
              photo.predTags && photo.predTags.includes(item) ? "green" : "";
            return (
              <Tag key={item} color={color}>
                {item}
              </Tag>
            );
          })}
        </div>
      ) : null}
      {showPredTags && photo.predTags && !isCorrect ? (
        <div className="pred-tags">
          {showTrueTags ? <strong>Pred</strong> : null}
          {photo.predTags.map(item => {
            let color = "";
            if (showTrueTags) {
              color = photo.tags.includes(item) ? "green" : "magenta";
            }
            return (
              <Tag key={item} color={color}>
                {item}
              </Tag>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
