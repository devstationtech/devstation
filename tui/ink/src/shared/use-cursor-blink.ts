import { useEffect, useState } from "react";

export function useCursorBlink(): boolean {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const id = setInterval(() => setVisible((v) => !v), 500);
    return () => clearInterval(id);
  }, []);
  return visible;
}
