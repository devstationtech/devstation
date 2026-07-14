/// <reference types="@types/react" />
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { Box } from "ink";
import type { AuthSession } from "@jsonrpc-contracts-ts/auth.gen.ts";
import { ConfigurePasswordForm } from "@ui/auth/configure-password-form.tsx";
import { AuthenticatePasswordForm } from "@ui/auth/authenticate-password-form.tsx";
import { SessionProvider } from "@ui/auth/session-provider.tsx";
import { SESSION_EXPIRED, sessionExpired } from "@ui/shared/session-expired.ts";
import { useAuth } from "@ui/rpc-clients-provider.tsx";
import { Exception } from "@jsonrpc-client-ts/exception.ts";

type Gate = "loading" | "configure" | "authenticate" | "opened" | "closed";

type Props = {
  onCancel: () => void;
  children: () => ReactNode;
};

export function AuthGate({ onCancel, children }: Props) {
  const authClient = useAuth();
  const [gate, setGate] = useState<Gate>("loading");
  const [session, setSession] = useState<{ id: string; expiresAt: string } | null>(null);
  const [expired, setExpired] = useState(false);

  const check = useCallback(async () => {
    const configured = await authClient.configured();
    setGate(configured ? "authenticate" : "configure");
  }, [authClient]);

  useEffect(() => {
    check();
  }, [check]);

  const onLoggedIn = useCallback((response: AuthSession) => {
    setSession({ id: response.sessionId, expiresAt: response.expiresAt });
    setExpired(false);
    setGate("opened");
  }, []);

  // Global session-expired signal: the SessionExpiryClient interceptor
  // emits it when ANY RPC call returns an Unauthenticated wire error,
  // so a mid-session expiry on any screen bounces back to login.
  useEffect(() => {
    const handler = () => {
      setSession(null);
      setExpired(true);
      setGate("authenticate");
    };
    sessionExpired.addEventListener(SESSION_EXPIRED, handler);
    return () => sessionExpired.removeEventListener(SESSION_EXPIRED, handler);
  }, []);

  // Renewal loop — driven by the session's own expiresAt, not by an imported
  // backend constant. UI is now agnostic of SESSION_TTL.
  useEffect(() => {
    if (gate !== "opened" || !session) return;
    const lifetimeMs = new Date(session.expiresAt).getTime() - Date.now();
    const renewInMs = Math.max(1000, lifetimeMs / 2);
    const id = setTimeout(async () => {
      try {
        const renewed = await authClient.renew({ sessionId: session.id });
        setSession({ id: renewed.sessionId, expiresAt: renewed.expiresAt });
      } catch (error) {
        if (error instanceof Exception && error.isUnauthenticated()) {
          setSession(null);
          setExpired(true);
          setGate("authenticate");
          return;
        }
        setSession(null);
        setGate("closed");
      }
    }, renewInMs);
    return () => clearTimeout(id);
  }, [gate, session, authClient]);

  if (gate === "loading") return <Box />;
  if (gate === "configure") {
    return <ConfigurePasswordForm onConfigured={onLoggedIn} onCancel={onCancel} />;
  }
  if (gate === "authenticate" || gate === "closed") {
    return (
      <AuthenticatePasswordForm
        onAuthenticated={onLoggedIn}
        onCancel={onCancel}
        expired={expired}
      />
    );
  }

  if (!session) return <Box />;
  return (
    <SessionProvider session={{ sessionId: session.id, expiresAt: session.expiresAt }}>
      {children()}
    </SessionProvider>
  );
}
