import { lazy, Suspense, useEffect, useState } from "react";

const NetworkSphereView = lazy(() =>
  import("./NetworkSphereView").then((m) => ({ default: m.NetworkSphereView })),
);

/** Defers loading the Three.js globe bundle until after the intro animation */
export function LazyGlobe() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Start loading after a short delay so the intro text animation isn't janked
    const timer = setTimeout(() => setReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  if (!ready) return null;

  return (
    <Suspense fallback={null}>
      <NetworkSphereView />
    </Suspense>
  );
}
