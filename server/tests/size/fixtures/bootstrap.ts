import { Container } from "@server/container.ts";
import { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import { FileLogger } from "@server/shared/observability/outbound/file-logger.ts";
import type { Logger } from "@server/shared/observability/domain/ports/outbound/logger.ts";
import type {
  AuthenticatedSession,
  Authentication,
} from "@server/shared/authentication/domain/ports/outbound/authentication.ts";
import { Server } from "@server/shared/inbound/rpc/server.ts";
import { EndpointRegistry } from "@server/shared/inbound/rpc/endpoint/endpoint-registry.ts";
import { Client } from "@jsonrpc-client-ts/client.ts";
import { Adapter } from "@server/size/outbound/persistence/file-system/adapter.ts";
import { Query } from "@server/size/application/queries/all/query.ts";
import { RegisterSizeHandler } from "@server/size/application/handlers/register-size-handler.ts";
import { UnregisterSizeHandler } from "@server/size/application/handlers/unregister-size-handler.ts";
import {
  ListSizesEndpoint,
  RegisterSizeEndpoint,
  UnregisterSizeEndpoint,
} from "@server/size/inbound/rpc/endpoints.ts";
import { Persistence } from "@tests/size/integration/outbound/persistence.ts";

export const STUB_SESSION_ID = "00000000-0000-0000-0000-000000000001";
export const STUB_SESSION_KEY = "a".repeat(64);

export class StubAuthentication implements Authentication {
  check(_sessionId: string): AuthenticatedSession {
    return {
      sessionId: STUB_SESSION_ID,
      key: STUB_SESSION_KEY,
      expiresAt: new Date(Date.now() + 60_000),
    };
  }
}

export function testContainer(): Container {
  return new Container()
    .register(Persistence, () => new Persistence())
    .register(FileSystem, (c) => new FileSystem(c.get(Persistence).dir))
    .register(FileLogger, (c) => new FileLogger(new FileSystem(c.get(Persistence).dir)))
    .register(Adapter, (c) => new Adapter(c.get(FileSystem), c.get(FileLogger)))
    .register(Query, (c) => new Query(c.get(FileSystem)))
    .register(StubAuthentication, () => new StubAuthentication())
    .register(RegisterSizeHandler, (c) => new RegisterSizeHandler(c.get(Adapter)))
    .register(UnregisterSizeHandler, (c) => new UnregisterSizeHandler(c.get(Adapter)))
    .register(
      RegisterSizeEndpoint,
      (c) => new RegisterSizeEndpoint(c.get(RegisterSizeHandler)),
    )
    .register(
      UnregisterSizeEndpoint,
      (c) => new UnregisterSizeEndpoint(c.get(UnregisterSizeHandler)),
    )
    .register(ListSizesEndpoint, (c) => new ListSizesEndpoint(c.get(Query)))
    .build();
}

const silentLogger: Logger = {
  info: async () => {},
  warn: async () => {},
  error: async () => {},
};

/**
 * Builds an in-process Client wired to a Server with the full size
 * catalog registered. Endpoint integration tests use this to exercise the
 * JSON-RPC envelope, method routing, the Authenticated decorator and error
 * mapping without spawning a subprocess.
 */
export function buildClient(container: Container): Client {
  const server = new Server(
    EndpointRegistry.empty(container.get(StubAuthentication))
      .protected(container.get(RegisterSizeEndpoint))
      .protected(container.get(UnregisterSizeEndpoint))
      .protected(container.get(ListSizesEndpoint)),
    silentLogger,
    "test-core",
  );
  return new Client((request) => server.handle(request));
}
