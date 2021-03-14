/* eslint-disable react/jsx-props-no-spreading */
import React, { useEffect, useState, useMemo } from "react";
import { Progress } from "antd";

export default function SmoothProgress(initialProps) {
  const props = { ...initialProps };
  const {
    percent: targetPercent,
    duration = 2000,
    hideOnComplete = true
  } = props;
  const [percent, setPercent] = useState(targetPercent);
  const stepTime = useMemo(
    () => Math.round((0.8 * duration) / (targetPercent - percent)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [targetPercent]
  );

  useEffect(() => {
    let tProg;
    const nextFrame = () => {
      setPercent(prevPercent => {
        const diff = targetPercent - prevPercent;
        if (diff === 0) return targetPercent;
        const target = diff < 0 ? targetPercent : prevPercent + 1;
        if (target < targetPercent) {
          tProg = setTimeout(nextFrame, stepTime);
        }
        return target;
      });
    };
    tProg = setTimeout(nextFrame, stepTime);
    return () => {
      clearTimeout(tProg);
    };
  }, [stepTime, targetPercent]);

  props.percent = percent;
  if (percent >= 100 && hideOnComplete) return null;
  return <Progress {...props} />;
}
