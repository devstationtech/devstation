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
import { Adapter } from "@server/images/outbound/persistence/file-system/adapter.ts";
import { Adapter as ImageUsagesAdapter } from "@server/images/outbound/persistence/file-system/image-usages-adapter.ts";
import { Query } from "@server/images/application/queries/all/query.ts";
import { RegisterImageHandler } from "@server/images/application/handlers/register-image-handler.ts";
import { UpdateImageHandler } from "@server/images/application/handlers/update-image-handler.ts";
import { UnregisterImageHandler } from "@server/images/application/handlers/unregister-image-handler.ts";
import {
  ListImagesEndpoint,
  RegisterImageEndpoint,
  UnregisterImageEndpoint,
  UpdateImageEndpoint,
} from "@server/images/inbound/rpc/endpoints.ts";
import { Persistence } from "@tests/images/integration/outbound/persistence.ts";

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
    .register(ImageUsagesAdapter, (c) => new ImageUsagesAdapter(c.get(FileSystem)))
    .register(Query, (c) => new Query(c.get(FileSystem), c.get(ImageUsagesAdapter)))
    .register(StubAuthentication, () => new StubAuthentication())
    .register(RegisterImageHandler, (c) => new RegisterImageHandler(c.get(Adapter)))
    .register(UpdateImageHandler, (c) => new UpdateImageHandler(c.get(Adapter)))
    .register(UnregisterImageHandler, (c) => new UnregisterImageHandler(c.get(Adapter)))
    .register(RegisterImageEndpoint, (c) => new RegisterImageEndpoint(c.get(RegisterImageHandler)))
    .register(UpdateImageEndpoint, (c) => new UpdateImageEndpoint(c.get(UpdateImageHandler)))
    .register(
      UnregisterImageEndpoint,
      (c) => new UnregisterImageEndpoint(c.get(UnregisterImageHandler)),
    )
    .register(ListImagesEndpoint, (c) => new ListImagesEndpoint(c.get(Query)))
    .build();
}

const silentLogger: Logger = {
  info: async () => {},
  warn: async () => {},
  error: async () => {},
};

/**
 * In-process Client wired to a Server with the full image catalog registered —
 * exercises the JSON-RPC envelope, routing, the Authenticated decorator and
 * error mapping without spawning a subprocess.
 */
export function buildClient(container: Container): Client {
  const server = new Server(
    EndpointRegistry.empty(container.get(StubAuthentication))
      .protected(container.get(RegisterImageEndpoint))
      .protected(container.get(UpdateImageEndpoint))
      .protected(container.get(UnregisterImageEndpoint))
      .protected(container.get(ListImagesEndpoint)),
    silentLogger,
    "test-core",
  );
  return new Client((request) => server.handle(request));
}
