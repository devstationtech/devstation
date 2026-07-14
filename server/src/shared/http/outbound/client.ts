export type HttpResponse = {
  status: number;
  body: string;
};

export type HttpRequestOptions = {
  headers?: Record<string, string>;
  timeoutSeconds?: number;
  skipTlsVerification?: boolean;
};

/**
 * Cross-OS HTTP client backed by Deno's native `fetch`. Replaced the
 * old `Deno.Command("curl", …)` flavor — `curl` isn't bundled on
 * Windows by default in pre-1803 builds and shells the host out for
 * every request even where it is. Using `fetch` keeps it in-process,
 * cross-OS, and removes one external dependency.
 *
 * `skipTlsVerification` is now informational only. `Deno.createHttpClient`
 * with `unsafelyIgnoreCertificateErrors` is silently ignored at
 * runtime — Deno only honors that toggle when passed as the CLI flag
 * `--unsafely-ignore-certificate-errors`. The engine binary is
 * compiled WITH that flag (see `release/scripts/build-release.ts`),
 * so cert validation is disabled for every outbound HTTPS request the
 * engine makes. The flag stays on the API for forward compatibility —
 * when we later swap to a per-host CA pinning model, callers that
 * opted in will get the right behaviour without API churn.
 *
 * Scope note: this is engine-wide and not configurable in the alpha.
 * Homelab Proxmox boxes ship self-signed by default; refusing them
 * blocks the entire flow. The UI never carries the flag — neither the
 * compiled binary nor the dev entry (`tui/ink/bin/devstation`) — since
 * it only speaks JSON-RPC to the local engine and makes no outbound TLS
 * calls. The engine's startup "TLS validation disabled" warning is
 * captured to `<home>/logs/engine.stderr.log` by the UI's subprocess
 * spawn instead of leaking onto the terminal / Ink TUI.
 */
export class HttpClient {
  async get(url: string, options: HttpRequestOptions = {}): Promise<HttpResponse> {
    const { headers = {}, timeoutSeconds = 5 } = options;
    // `skipTlsVerification` accepted for forward compat — see class
    // docstring. The engine binary ignores certs unconditionally.

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutSeconds * 1000);

    const init: RequestInit = {
      method: "GET",
      headers,
      signal: controller.signal,
    };

    try {
      const response = await fetch(url, init);
      const body = await response.text();
      return { status: response.status, body };
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new HttpClientError(`request timed out after ${timeoutSeconds}s.`, url);
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new HttpClientError(`request failed: ${message}`, url);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async getJson<T>(
    url: string,
    options: HttpRequestOptions = {},
  ): Promise<{ status: number; data: T }> {
    const response = await this.get(url, options);

    if (!response.body.trim()) {
      return { status: response.status, data: null as T };
    }

    try {
      const json = JSON.parse(response.body);
      return { status: response.status, data: json as T };
    } catch {
      throw new HttpClientError(`invalid JSON response.`, url);
    }
  }
}

export class HttpClientError extends Error {
  constructor(message: string, readonly url: string) {
    super(message);
  }
}
