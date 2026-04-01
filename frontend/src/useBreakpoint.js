import { useState, useEffect } from "react";

/**
 * True when viewport width is at most maxWidthPx (inclusive).
 */
export function useBreakpoint(maxWidthPx) {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(`(max-width: ${maxWidthPx}px)`).matches : false
  );

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${maxWidthPx}px)`);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [maxWidthPx]);

  return matches;
}
