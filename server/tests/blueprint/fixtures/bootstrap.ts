import { Container } from "@server/container.ts";
import { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import type { Logger } from "@server/shared/observability/domain/ports/outbound/logger.ts";
import type {
  AuthenticatedSession,
  Authentication,
} from "@server/shared/authentication/domain/ports/outbound/authentication.ts";
import { Server } from "@server/shared/inbound/rpc/server.ts";
import { EndpointRegistry } from "@server/shared/inbound/rpc/endpoint/endpoint-registry.ts";
import { Client } from "@jsonrpc-client-ts/client.ts";
import { Blueprints } from "@server/blueprint/blueprints.ts";
import { Query as AllBlueprintsQuery } from "@server/blueprint/application/queries/all/query.ts";
import { Query as BlueprintByIdQuery } from "@server/blueprint/application/queries/by-id/query.ts";
import {
  BlueprintByIdEndpoint,
  ListBlueprintsEndpoint,
} from "@server/blueprint/inbound/rpc/endpoints.ts";

export const STUB_SESSION_ID = "00000000-0000-0000-0000-000000000001";

/** The repo's real blueprint catalog — read-only, deterministic. */
const CATALOG_ROOT = "blueprints";

export class StubAuthentication implements Authentication {
  check(_sessionId: string): AuthenticatedSession {
    return {
      sessionId: STUB_SESSION_ID,
      key: "a".repeat(64),
      expiresAt: new Date(Date.now() + 60_000),
    };
  }
}

export function testContainer(): Container {
  return new Container()
    .register(FileSystem, () => new FileSystem(CATALOG_ROOT))
    .register(Blueprints, (c) => new Blueprints(c.get(FileSystem)))
    .register(AllBlueprintsQuery, (c) => new AllBlueprintsQuery(c.get(Blueprints)))
    .register(BlueprintByIdQuery, (c) => new BlueprintByIdQuery(c.get(Blueprints)))
    .register(StubAuthentication, () => new StubAuthentication())
    .register(ListBlueprintsEndpoint, (c) => new ListBlueprintsEndpoint(c.get(AllBlueprintsQuery)))
    .register(BlueprintByIdEndpoint, (c) => new BlueprintByIdEndpoint(c.get(BlueprintByIdQuery)))
    .build();
}

const silentLogger: Logger = {
  info: async () => {},
  warn: async () => {},
  error: async () => {},
};

/**
 * Builds an in-process Client wired to a Server with the blueprint
 * catalog registered. Endpoint integration tests use this to exercise
 * the JSON-RPC envelope, method routing, the Authenticated decorator
 * and error mapping without spawning a subprocess.
 */
export function buildClient(container: Container): Client {
  const server = new Server(
    EndpointRegistry.empty(container.get(StubAuthentication))
      .protected(container.get(ListBlueprintsEndpoint))
      .protected(container.get(BlueprintByIdEndpoint)),
    silentLogger,
    "test-core",
  );
  return new Client((request) => server.handle(request));
}
