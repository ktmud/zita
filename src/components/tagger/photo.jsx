import React, { useContext } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { Button, Icon } from "antd";
import { imageUrl } from "lib/client";
import { AppContext } from "components/context";

const ButtonGroup = Button.Group;

function toKbytes(bytes) {
  return `${Math.ceil(bytes / 1024)} KB`;
}

/**
 * Only the current photo we are tagging
 */
function Photo({ photo, prevPhoto, nextPhoto }) {
  const history = photo.history || [];
  const { tagOptions } = useContext(AppContext);

  const addHistory = val => {
    // keep at most two consequtive entries for the same val
    if (
      history.length < 2 ||
      history[history.length - 1] !== val ||
      history[history.length - 2] !== val
    ) {
      history.push(val);
    }
  };

  const onTagButtonClick = e => {
    addHistory(e.target.value);
    photo.toggleTag(e.target.value);
  };

  const noButtonFocused = () => {
    return document.querySelector("button:focus") == null;
  };

  // toggle tags with number keys (0 ~ 9) +
  // use Enter to save, Backspance to revert
  const nums = [...Array(Math.min(tagOptions.length + 1, 10)).keys()];
  useHotkeys(
    `${nums.join(",")},backspace,enter,space`,
    (e, handler) => {
      if (
        (handler.key === "enter" || handler.key === "space") &&
        noButtonFocused()
      ) {
        if (handler.key === "enter") {
          photo.save();
        } else {
          nextPhoto();
        }
        return;
      }
      if (handler.key === "backspace") {
        // revert last tagging action
        if (history.length > 0) {
          const val = history.pop();
          photo.toggleTag(val);
        } else {
          // if no action to revert, go to previous photo
          prevPhoto();
        }
        return;
      }
      if (!photo) return;
      // toggle tags by number key
      let idx = parseInt(handler.key, 10) - 1;
      if (idx < 0) {
        idx += tagOptions.length;
      }
      const val = tagOptions[idx];
      addHistory(val);
      photo.toggleTag(val);
    },
    [photo]
  );

  return (
    <>
      <div className="image-wrap">
        <div className="nav-buttons">
          <Button
            onClick={() => prevPhoto()}
            className="prev"
            type="link"
            size="large"
          >
            <Icon type="left" />
          </Button>
          <Button
            onClick={() => nextPhoto()}
            className="next"
            type="link"
            size="large"
          >
            <Icon type="right" />
          </Button>
        </div>
        <p className="image-title">
          {photo.id}
          <span className="image-fsize">{toKbytes(photo.size)}</span>
        </p>
        <img src={imageUrl(photo.id)} alt="" />
      </div>
      <div className="tag-options">
        <ButtonGroup
          size="large"
          className="tag-buttons"
          onClick={onTagButtonClick}
        >
          {tagOptions.map((tag, i) => (
            <Button
              key={tag}
              value={tag}
              className={photo.tags.includes(tag) ? "active" : null}
            >
              <span className="tag-idx">{(i + 1) % 10}</span>
              <span className="tag-text">{tag}</span>
            </Button>
          ))}
        </ButtonGroup>
        <ButtonGroup className="action-buttons">
          <Button
            type="primary"
            icon="check"
            size="large"
            loading={photo.saving}
            disabled={!photo.hasChanges()}
            onClick={() => photo.save()}
          >
            Save
          </Button>
        </ButtonGroup>
      </div>
    </>
  );
}

export default Photo;
