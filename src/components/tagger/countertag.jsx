import React from "react";
import { Tag, Tooltip } from "antd";
import { tagColor } from "lib/utils";

function CounterTag({
  totalPhotos,
  taggedPhotos,
  suffix,
  titleFormatter = x => (Number.isNaN(x) ? "" : `${(x * 100).toFixed(2)}%`)
}) {
  const completeness = taggedPhotos / totalPhotos;
  const title = titleFormatter && titleFormatter(completeness);
  const tag = (
    <Tag color={tagColor(completeness)}>
      {taggedPhotos}/{totalPhotos}
      {suffix}
    </Tag>
  );
  return title ? <Tooltip title={title}>{tag}</Tooltip> : tag;
}

export default CounterTag;
