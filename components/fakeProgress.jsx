import React, { useEffect, createRef, useState } from "react";

const globalProgress = createRef(0);

function FakeProgress({ router }) {
  const [progress, setProgress] = useState(globalProgress.current);

  useEffect(() => {
    let tReroute = 0;

    const updateProgress = (p, startNext = true) => {
      setProgress(prev => {
        const prog =
          p === undefined ? Math.min(prev + Math.random() * 3, 95) : p;

        globalProgress.current = prog;

        if (startNext) {
          tReroute = setTimeout(() => {
            updateProgress();
          }, 30 + 40 * prog);
        }
        return prog;
      });
    };

    const onRouteChangeStart = () => {
      clearTimeout(tReroute);
      tReroute = setTimeout(() => {
        updateProgress();
      }, 200);
    };

    const onRouteChangeComplete = () => {
      clearTimeout(tReroute);
      setProgress(100);
      tReroute = setTimeout(() => {
        updateProgress(0, false);
      }, 500);
    };

    const onRouteChangeError = () => {
      clearTimeout(tReroute);
      // updateProgress(0, false);
    };

    router.events.on("routeChangeStart", onRouteChangeStart);
    router.events.on("routeChangeComplete", onRouteChangeComplete);
    router.events.on("routeChangeError", onRouteChangeError);

    return () => {
      router.events.off("routeChangeStart", onRouteChangeStart);
      router.events.off("routeChangeComplete", onRouteChangeComplete);
      router.events.off("routeChangeError", onRouteChangeError);
      clearTimeout(tReroute);
    };
  }, [router.events]);

  return progress ? (
    <div
      className={`fake-progress ${progress >= 100 ? "done" : ""}`}
      style={{ width: `${progress}%` }}
    />
  ) : (
    ""
  );
}

export default FakeProgress;
