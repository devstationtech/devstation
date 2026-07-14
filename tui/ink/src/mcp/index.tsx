/// <reference types="@types/react" />
import { useCallback, useEffect, useState } from "react";
import { Box, Text, useInput } from "ink";
import type { AuthTokenState } from "@jsonrpc-contracts-ts/auth.gen.ts";
import { useAuth } from "@ui/rpc-clients-provider.tsx";
import { useSessionId } from "@ui/auth/session-provider.tsx";
import { HelpBar } from "@ui/shared/help-bar.tsx";
import {
  Alert,
  Confirm,
  Form,
  type Intent,
  ScreenFrame,
  Spinner,
} from "@ui/shared/design-system/mod.ts";
import { ScopePicker } from "@ui/mcp/scope-picker.tsx";
import { ALL_SCOPE_OPTIONS } from "@ui/mcp/scope-catalog.ts";
import { DimText } from "@ui/shared/theme/mod.ts";

type Phase =
  | "loading"
  | "overview"
  | "scopes"
  | "expiry"
  | "password"
  | "working"
  | "confirm-revoke"
  | "result";

type Result =
  | { kind: "success"; summary: string; detail: string }
  | { kind: "error"; summary: string; detail?: string };

type Props = {
  onBack: () => void;
};

function shortError(message: string): string {
  const first = message.split("\n")[0]?.trim() ?? message;
  return first.length > 80 ? first.slice(0, 77) + "..." : first;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toISOString().slice(0, 10);
}

const scopeLabel = (scope: string): string =>
  ALL_SCOPE_OPTIONS.find((o) => o.scope === scope)?.scope ?? scope;

/**
 * `/mcp` — manage the scoped MCP access token.
 *
 * Lets the operator pick which resources the MCP server may touch
 * (GitHub-PAT style), choose an expiry, re-confirm the master password,
 * and mint a token persisted to `~/.devstation/mcp.json`. With a token in
 * place the MCP server boots with those scopes and no password is needed.
 */
export function McpScreen({ onBack }: Props) {
  const authClient = useAuth();
  const sessionId = useSessionId();

  const [phase, setPhase] = useState<Phase>("loading");
  const [token, setToken] = useState<AuthTokenState | null>(null);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [ttlDays, setTtlDays] = useState<number | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const loadToken = useCallback(async () => {
    setPhase("loading");
    try {
      const state = await authClient.currentToken({ sessionId });
      setToken(state);
      setPhase("overview");
    } catch (err) {
      setResult({ kind: "error", summary: shortError((err as Error).message) });
      setPhase("result");
    }
  }, [authClient, sessionId]);

  useEffect(() => {
    loadToken();
  }, [loadToken]);

  const startGenerate = useCallback(() => {
    setSelected(new Set(token?.present ? token.scopes ?? [] : []));
    setPhase("scopes");
  }, [token]);

  const toggleScope = useCallback((scope: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(scope)) next.delete(scope);
      else next.add(scope);
      return next;
    });
  }, []);

  const mint = useCallback(async (password: string) => {
    setPhase("working");
    try {
      // Re-prove the master password: a fresh session both verifies the
      // password and authorizes minting the long-lived capability file.
      const proven = await authClient.authenticate({ password });
      const summary = await authClient.generateToken({
        sessionId: proven.sessionId,
        scopes: [...selected],
        ttlDays,
      });
      const expiry = summary.expiresAt
        ? `expires ${formatDate(summary.expiresAt)}`
        : "never expires";
      setResult({
        kind: "success",
        summary: `MCP token minted — ${summary.scopes.length} scope(s), ${expiry}`,
        detail:
          "Saved to ~/.devstation/mcp.json. The MCP server now boots with these scopes; no master password needed.",
      });
    } catch (err) {
      setResult({ kind: "error", summary: shortError((err as Error).message) });
    }
    setPhase("result");
  }, [authClient, selected, ttlDays]);

  const revoke = useCallback(async () => {
    setPhase("working");
    try {
      await authClient.revokeToken({ sessionId });
      setResult({
        kind: "success",
        summary: "MCP token revoked",
        detail: "~/.devstation/mcp.json removed. The MCP server reverts to its read-only surface.",
      });
    } catch (err) {
      setResult({ kind: "error", summary: shortError((err as Error).message) });
    }
    setPhase("result");
  }, [authClient, sessionId]);

  // Overview key handling: g generates, r revokes (only when a token exists).
  useInput((char, key) => {
    if (phase !== "overview") return;
    if (key.escape) {
      onBack();
      return;
    }
    if (char === "g") {
      startGenerate();
      return;
    }
    if (char === "r" && token?.present) {
      setPhase("confirm-revoke");
      return;
    }
  }, { isActive: phase === "overview" });

  // Result key handling: dismiss back to a refreshed overview.
  useInput((_char, key) => {
    if (phase !== "result") return;
    if (key.return || key.escape) loadToken();
  }, { isActive: phase === "result" });

  const intent: Intent | undefined = phase === "result"
    ? (result?.kind === "success" ? "success" : "danger")
    : undefined;

  const renderBody = () => {
    if (phase === "loading" || phase === "working") {
      return <Spinner label={phase === "working" ? "applying..." : "loading..."} />;
    }

    if (phase === "overview") {
      if (!token?.present) {
        return (
          <Box flexDirection="column" gap={1}>
            <DimText>
              No MCP access token is configured. The MCP server currently exposes only its read-only
              surface.
            </DimText>
            <Text>Generate a token to choose which resources the MCP server may use.</Text>
          </Box>
        );
      }
      return (
        <Box flexDirection="column">
          <Text bold color="green">A scoped MCP token is configured.</Text>
          <Box marginTop={1} flexDirection="column">
            <Text>
              <DimText>{"id".padEnd(9)}</DimText>
              {token.id}
            </Text>
            <Text>
              <DimText>{"scopes".padEnd(9)}</DimText>
              {(token.scopes ?? []).map(scopeLabel).join(", ")}
            </Text>
            <Text>
              <DimText>{"created".padEnd(9)}</DimText>
              {token.createdAt ? formatDate(token.createdAt) : "—"}
            </Text>
            <Text>
              <DimText>{"expires".padEnd(9)}</DimText>
              {token.expiresAt ? formatDate(token.expiresAt) : "never"}
            </Text>
          </Box>
        </Box>
      );
    }

    if (phase === "scopes") {
      return (
        <Box flexDirection="column">
          <DimText>
            Select the resources the MCP server may access. Provisioning sub-scopes (plan / apply /
            destroy) are granted individually.
          </DimText>
          <Box marginTop={1}>
            <ScopePicker
              selected={selected}
              onToggle={toggleScope}
              onSubmit={() => {
                if (selected.size > 0) setPhase("expiry");
              }}
              onCancel={() => setPhase("overview")}
            />
          </Box>
          {selected.size === 0 && (
            <Box marginTop={1}>
              <Text color="yellow">Select at least one scope to continue.</Text>
            </Box>
          )}
        </Box>
      );
    }

    if (phase === "expiry") {
      return (
        <Box flexDirection="column">
          <DimText>How long should the token stay valid?</DimText>
          <Box marginTop={1}>
            <Form
              fields={[
                {
                  type: "string",
                  name: "days",
                  label: "expires in (days)",
                  description: "leave empty for the default (90 days)",
                  validate: (v) => {
                    if (!v.trim()) return null;
                    return /^\d+$/.test(v.trim()) && Number(v.trim()) > 0
                      ? null
                      : "must be a positive whole number of days";
                  },
                },
              ]}
              onSubmit={(values) => {
                const raw = values.days.trim();
                setTtlDays(raw ? Number(raw) : null);
                setPhase("password");
              }}
              onCancel={() => setPhase("scopes")}
            />
          </Box>
        </Box>
      );
    }

    if (phase === "password") {
      return (
        <Box flexDirection="column">
          <DimText>
            Confirm your master password to mint the token for {selected.size} scope(s).
          </DimText>
          <Box marginTop={1}>
            <Form
              fields={[
                {
                  type: "string",
                  name: "password",
                  label: "master password",
                  required: true,
                  mask: "*",
                },
              ]}
              onSubmit={(values) => {
                if (values.password) mint(values.password);
              }}
              onCancel={() => setPhase("expiry")}
            />
          </Box>
        </Box>
      );
    }

    if (phase === "confirm-revoke") {
      return (
        <Confirm
          intent="danger"
          question="Revoke the MCP access token? The MCP server will lose all scoped access."
          confirmWord="revoke"
          onConfirm={revoke}
          onCancel={() => setPhase("overview")}
        />
      );
    }

    // result
    return (
      <Box flexDirection="column" gap={1}>
        <Alert intent={result?.kind === "success" ? "success" : "danger"}>
          {result?.summary ?? ""}
        </Alert>
        {result?.detail && <DimText>{result.detail}</DimText>}
      </Box>
    );
  };

  const footer = (() => {
    if (phase === "overview") {
      return (
        <HelpBar>
          {token?.present ? "g regenerate · r revoke · esc back" : "g generate · esc back"}
        </HelpBar>
      );
    }
    if (phase === "scopes") {
      return <HelpBar>↑↓ move · space toggle · ↵ continue · esc back</HelpBar>;
    }
    if (phase === "expiry") return <HelpBar>↵ next · esc back · ctrl+x cancel</HelpBar>;
    if (phase === "password") return <HelpBar>↵ confirm · esc back · ctrl+x cancel</HelpBar>;
    if (phase === "result") return <HelpBar>↵ done</HelpBar>;
    return undefined;
  })();

  return (
    <ScreenFrame breadcrumb={["mcp"]} intent={intent} footer={footer} boxLayout="top">
      {renderBody()}
    </ScreenFrame>
  );
}
