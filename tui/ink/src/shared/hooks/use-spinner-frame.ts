/// <reference types="@types/react" />
import { useEffect, useState } from "react";

// Cycles through `frames` every `intervalMs` while `active` is true.
// Returns the current frame string. Stops the timer when inactive to keep
// idle screens quiet.
export function useSpinnerFrame(
  frames: readonly string[],
  intervalMs = 80,
  active = true,
): string {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!active) return;
    const handle = setInterval(() => setI((prev) => (prev + 1) % frames.length), intervalMs);
    return () => clearInterval(handle);
  }, [active, intervalMs, frames]);
  return frames[i % frames.length] ?? frames[0] ?? "";
}
