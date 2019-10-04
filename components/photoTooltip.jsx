import React from "react";
import { Tooltip } from "antd";
import { imageUrl } from "lib/client";
import PhotoTagsDiff from "./photoTagsDiff";

function PhotoTooltip({
  photo,
  placement = "left",
  width = 250,
  mouseEnterDelay = 0.1,
  children,
  showPhoto = true,
  showTags = false,
  showPredTags = false,
  overlayClassName,
  overlayStyle = {}
}) {
  const tooltipContent = (
    <div className="photo-tooltip-content">
      <span
        style={{
          lineHeight: "1.1em",
          marginBottom: "0.5em",
          display: "inline-block",
          wordBreak: "break-all"
        }}
      >
        {photo.id}
      </span>
      <br />
      {showPhoto ? (
        <img
          alt={`${photo.id}`}
          src={imageUrl(photo.id)}
          style={{ maxWidth: "100%" }}
        />
      ) : null}
      <PhotoTagsDiff
        photo={photo}
        showTags={showTags}
        showPredTags={showPredTags}
      />
    </div>
  );

  const style = { width, ...overlayStyle };
  return (
    <Tooltip
      title={tooltipContent}
      placement={placement}
      overlayClassName={`photo-tooltip ${overlayClassName}`}
      overlayStyle={style}
      mouseEnterDelay={mouseEnterDelay}
    >
      {children}
    </Tooltip>
  );
}

export default PhotoTooltip;
