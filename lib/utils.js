/**
 * Find first available (untagged) photo for tagging
 * if gives an id, find first photo of specified id
 * @returns the index (not id) of the available photo
 */
export const firstUntagged = (photos, totalPhotos) => {
  if (photos) {
    const total = photos.length;
    for (let i = 0; i < total; i += 1) {
      if (photos[i].tags.length === 0) return i;
    }
    // if still haven't found any untagged photo, use the first
    if (total >= totalPhotos) {
      return 0;
    }
  }
  return null;
};

export const locById = (photos, id) => {
  if (photos) {
    const total = photos.length;
    for (let i = 0; i < total; i += 1) {
      if (id === photos[i].id) return i;
    }
  }
  return null;
};

export const tagColor = pct => {
  if (pct >= 0.9) {
    return "green";
  }
  if (pct >= 0.5) {
    return "cyan";
  }
  if (pct >= 0.1) {
    return "lime";
  }
  if (pct >= 0.05) {
    return "gold";
  }
  return "";
};
