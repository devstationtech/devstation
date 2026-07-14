/// <reference types="@types/react" />
import { createContext, type ReactNode, useContext } from "react";

/**
 * Exposes the currently-authenticated session to children inside AuthGate.
 *
 * AuthGate wraps `children()` in this provider only when `gate === "opened"`,
 * so any consumer that calls `useSessionId()` is guaranteed to be downstream
 * of a successful authentication. The hook throws if used outside, which is
 * a programming error (not a runtime auth check — the gate above ensures it).
 */
interface SessionState {
  readonly sessionId: string;
  readonly expiresAt: string;
}

const SessionContext = createContext<SessionState | null>(null);

export interface SessionProviderProps {
  readonly session: SessionState;
  readonly children: ReactNode;
}

export function SessionProvider({ session, children }: SessionProviderProps) {
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const session = useContext(SessionContext);
  if (session === null) {
    throw new Error(
      "useSession called outside <SessionProvider>. The current React subtree is not authenticated.",
    );
  }
  return session;
}

export function useSessionId(): string {
  return useSession().sessionId;
}
