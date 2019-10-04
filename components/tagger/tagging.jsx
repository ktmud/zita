import React, {
  useState,
  useEffect,
  useContext,
  useCallback,
  useRef
} from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { Row, Switch, Icon, message } from "antd";
import { setCookie } from "nookies";
import {
  fetchgql,
  fetchPhotos,
  PAGE_SIZE,
  PERSISTENT_COOKIE
} from "lib/client";
import { firstUntagged } from "lib/utils";
import { AppContext } from "components/context";
import Debug from "debug";
import Photo from "./photo";

const fetchDebug = Debug("ZT.fetch");
// const saveDebug = Debug("ZT.save");

const TAG_PHOTO = `
  mutation TagPhoto($id: String!, $tags: [String!]!) {
    mutated: tagPhoto(id: $id, tags: $tags) {
      id
      taggers
      tags
      incr
    }
  }
`;

/**
 * Save tags for a photo
 */
function tagPhoto({ id, tags }) {
  return fetchgql(TAG_PHOTO, { id, tags });
}

// merge old and new photos, return newly found first untagged
// if not yet set
function mergePhotos(newPhotos, prevPhotos, current, totalPhotos) {
  const prevPhotoList = prevPhotos || [];
  const newPhotoList = prevPhotoList.concat(newPhotos);
  let cur = current;
  if (cur == null) {
    cur = firstUntagged(newPhotos, totalPhotos);
    if (cur != null) {
      cur += prevPhotoList.length;
    } else if (newPhotoList.length >= totalPhotos) {
      cur = 0;
    }
  }
  return [cur, newPhotoList];
}

/**
 * The current album we are tagging, including navigations for switching between
 * photos.
 */
function Tagging({ album, onAlbumUpdate }) {
  const { current, photos, totalPhotos, taggedPhotos } = album;
  const { cookies } = useContext(AppContext);
  const autoSave = cookies.autosave !== "0";
  const photo = photos && photos[current];

  const loadedPhotos = photos && photos.length;
  const loadedTagged = album.tagged && album.tagged.length;

  const [saving, setSaving] = useState(false); // saving phototags
  const loading = useRef(false);
  const onFetch = useRef(null);
  onFetch.current = ({ album: alb }) => {
    loading.current = false;
    const [cur, newPhotoList] = mergePhotos(
      alb.photos,
      photos,
      current,
      alb.totalPhotos
    );
    fetchDebug("%s loaded", newPhotoList.length);
    // update currentAlbum to the new data obtained
    onAlbumUpdate({
      ...alb,
      photos: newPhotoList,
      current: cur
    });
  };
  const loadPhotos = params => {
    if (loading.current) return;
    loading.current = true;
    fetchPhotos(params)
      .then(data => onFetch.current(data))
      .catch(error => {
        loading.current = false;
        fetchDebug(error);
        message.error("Failed to load photos");
      });
  };

  const setCurrent = cur => {
    onAlbumUpdate({ current: cur });
  };

  // sometimes `photos` is not passed as initial props
  // fetch more photos
  const fetchMore = useCallback(
    reason => {
      if (
        loading.current ||
        !totalPhotos ||
        !loadedPhotos ||
        loadedPhotos >= totalPhotos
      )
        return;
      fetchDebug("triggered because %s", reason || "");
      // fetchDebug("%s/%s already loaded", loadedPhotos, totalPhotos);
      loadPhotos({
        albumId: album.id,
        offset: loadedPhotos,
        // 20 additional pages at a time
        limit: 20 * PAGE_SIZE
      });
    },
    [album.id, loadedPhotos, totalPhotos]
  );
  const getNextIdx = (stepSize = 1) => {
    return (current + stepSize) % totalPhotos;
  };
  const switchTo = targetIndex => {
    let cur = targetIndex;
    if (Number.isNaN(cur) || cur === false) return;
    if (cur == null) {
      cur = getNextIdx();
    }
    setCurrent(cur);
  };
  const savePhotoTags = nextIdx => {
    // `photo` in the list would be another object
    // had users made any changes to the tags
    const phot = photos[current];
    // if no change, skip
    if (!phot.hasChanges()) {
      switchTo(nextIdx);
      return;
    }
    // delayed feedback of saving status
    const t = setTimeout(() => {
      setSaving(true);
    }, 200);
    tagPhoto(phot)
      .then(({ mutated }) => {
        clearTimeout(t);
        setSaving(false);
        // empty current photo's edit history
        phot.history = null;
        // update album's photo counter
        onAlbumUpdate({
          photos: [...photos],
          taggers: mutated.taggers,
          taggedPhotos: taggedPhotos + mutated.incr
        });
        // switch to the next photo
        switchTo(nextIdx);
      })
      .catch(() => {
        clearTimeout(t);
        message.error("Failed to save photo tags.");
        setSaving(false);
      });
  };
  const saveAndSwitch = targetIndex => {
    if (photo && photo.hasChanges() && autoSave) {
      savePhotoTags(targetIndex);
    } else {
      switchTo(targetIndex);
    }
  };
  const nextPhoto = (stepSize = 1) => {
    saveAndSwitch(getNextIdx(stepSize));
  };
  const prevPhoto = (stepSize = 1) => {
    let cur = current - stepSize;
    if (cur < 0) {
      cur += totalPhotos;
    }
    saveAndSwitch(cur);
  };

  if (photo) {
    photo.idx = current;
    photo.history = photo.history || [];
    const { history } = photo;
    photo.hasChanges = () => history && history.length > 0;
    photo.saving = saving;
    photo.save = savePhotoTags;
    photo.toggleTag = val => {
      // val can never be null
      if (!photo || !val) return;
      let { tags } = photo;
      // toggle value
      if (tags.includes(val)) {
        tags = tags.filter(x => x && x !== val);
      } else {
        tags = [...tags, val];
      }
      photo.tags = tags;
      onAlbumUpdate(null, photo);
    };
  }

  // navigate hotkeys
  useHotkeys(
    "h,j,k,l,[,],left,right",
    (event, handler) => {
      switch (handler.key) {
        case "h":
        case "k":
        case "left":
          prevPhoto();
          break;
        case "j":
        case "l":
        case "right":
          nextPhoto();
          break;
        case "]":
          nextPhoto(PAGE_SIZE);
          break;
        case "[":
          prevPhoto(PAGE_SIZE);
          break;
        default:
          break;
      }
    },
    [album.id, current]
  );

  // trigger initial load when album changes and `photos` are not loaded
  useEffect(() => {
    if (photos) return;
    loadPhotos({
      albumId: album.id,
      // fetch all tagged photos and PAGE_SIZE more
      // (assuming tagged ones are all at the begining)
      limit: taggedPhotos + PAGE_SIZE
    });
  }, [album.id, photos, taggedPhotos]);

  useEffect(() => {
    if (loadedTagged < taggedPhotos) fetchMore("loadedTagged < tagged");
  }, [fetchMore, loadedTagged, taggedPhotos]);

  useEffect(() => {
    let cur = current;
    if (cur == null && photos) {
      cur = firstUntagged(photos, totalPhotos);
    }
    // fetch more photos if current is beyond loaded photos list
    if (cur >= loadedPhotos && cur < totalPhotos) {
      fetchMore("current > loaded");
    }
  }, [album.id, totalPhotos, current, loadedPhotos, photos, fetchMore]);

  const toggleAutoSave = flag => {
    if (flag) {
      setCookie(null, "autosave", "1", PERSISTENT_COOKIE);
    } else {
      setCookie(null, "autosave", "0", PERSISTENT_COOKIE);
    }
  };
  // useEffect(() => {
  //   if (!autoSave) return null;
  //   let tAutoSave;
  //   const runAutoSave = () => {
  //     const toSave = photos.filter(p => {
  //       return p.hasChanges && p.hasChanges();
  //     });
  //     saveDebug("Saving %d photos", toSave.length, toSave);
  //     toSave.forEach(p => {
  //       p.save();
  //     });
  //     tAutoSave = setTimeout(runAutoSave, 5000);
  //   };
  //   tAutoSave = setTimeout(runAutoSave, 2000);
  //   return () => {
  //     clearTimeout(tAutoSave);
  //   };
  // }, [photos, autoSave]);

  // console.log('Render', current, loadedPhotos);
  if (!totalPhotos || (photos && photos.length === 0)) {
    return (
      <Row
        className="tagging"
        type="flex"
        justify="space-around"
        align="middle"
      >
        <div className="placeholder">
          <span>NO PHOTO</span>
        </div>
      </Row>
    );
  }

  return (
    <Row className="tagging" type="flex" justify="space-around" align="middle">
      <div className="item-index">
        <strong>{current == null ? "-" : current + 1}</strong> / {totalPhotos}
      </div>
      <div className="autosave-switch">
        AUTOSAVE{" "}
        <Switch
          size="small"
          defaultChecked={autoSave}
          onChange={toggleAutoSave}
        />
      </div>
      {photo ? (
        <Photo photo={photo} prevPhoto={prevPhoto} nextPhoto={nextPhoto} />
      ) : (
        <Icon type="sync" spin />
      )}
    </Row>
  );
}

export default Tagging;
