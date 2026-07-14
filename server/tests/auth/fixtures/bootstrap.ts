import { Container } from "@server/container.ts";
import { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import type { Logger } from "@server/shared/observability/domain/ports/outbound/logger.ts";
import { Server } from "@server/shared/inbound/rpc/server.ts";
import { EndpointRegistry } from "@server/shared/inbound/rpc/endpoint/endpoint-registry.ts";
import { SessionsAdapter } from "@server/auth/outbound/sessions-adapter.ts";
import { Argon2Adapter } from "@server/auth/outbound/argon2-adapter.ts";
import { ConfigureHandler } from "@server/auth/application/handlers/configure-handler.ts";
import { AuthenticateHandler } from "@server/auth/application/handlers/authenticate-handler.ts";
import { RenewHandler } from "@server/auth/application/handlers/renew-handler.ts";
import { ConfigureEndpoint } from "@server/auth/inbound/rpc/configure/endpoint.ts";
import { ConfiguredEndpoint } from "@server/auth/inbound/rpc/configured/endpoint.ts";
import { Query as IsAuthConfiguredQuery } from "@server/auth/application/queries/configured/query.ts";
import { Query as LocalResourcesQuery } from "@server/auth/application/queries/local-resources/query.ts";
import { LinuxLocalResourcesAdapter } from "@server/auth/outbound/local-resources/linux.ts";
import { ResourcesEndpoint } from "@server/auth/inbound/rpc/resources/endpoint.ts";
import { AuthenticateEndpoint } from "@server/auth/inbound/rpc/authenticate/endpoint.ts";
import { RenewEndpoint } from "@server/auth/inbound/rpc/renew/endpoint.ts";
import { KeyWrapAdapter } from "@server/auth/outbound/key-wrap-adapter.ts";
import { TokenStoreAdapter } from "@server/auth/outbound/token-store-adapter.ts";
import { GenerateAccessTokenHandler } from "@server/auth/application/handlers/generate-access-token-handler.ts";
import { LoadAccessTokenHandler } from "@server/auth/application/handlers/load-access-token-handler.ts";
import { RevokeAccessTokenHandler } from "@server/auth/application/handlers/revoke-access-token-handler.ts";
import { GenerateTokenEndpoint } from "@server/auth/inbound/rpc/token/generate/endpoint.ts";
import { CurrentTokenEndpoint } from "@server/auth/inbound/rpc/token/current/endpoint.ts";
import { RevokeTokenEndpoint } from "@server/auth/inbound/rpc/token/revoke/endpoint.ts";
import { Client } from "@jsonrpc-client-ts/client.ts";
import { Persistence } from "@tests/auth/integration/outbound/persistence.ts";

export function testContainer(): Container {
  return new Container()
    .register(Persistence, () => new Persistence())
    .register(FileSystem, (c) => new FileSystem(c.get(Persistence).dir))
    .register(SessionsAdapter, () => new SessionsAdapter())
    .register(Argon2Adapter, (c) => new Argon2Adapter(c.get(FileSystem)))
    .register(
      ConfigureHandler,
      (c) => new ConfigureHandler(c.get(Argon2Adapter), c.get(SessionsAdapter)),
    )
    .register(IsAuthConfiguredQuery, (c) => new IsAuthConfiguredQuery(c.get(FileSystem)))
    .register(ConfiguredEndpoint, (c) => new ConfiguredEndpoint(c.get(IsAuthConfiguredQuery)))
    .register(
      LocalResourcesQuery,
      (c) => new LocalResourcesQuery(new LinuxLocalResourcesAdapter(c.get(FileSystem))),
    )
    .register(ResourcesEndpoint, (c) => new ResourcesEndpoint(c.get(LocalResourcesQuery)))
    .register(ConfigureEndpoint, (c) => new ConfigureEndpoint(c.get(ConfigureHandler)))
    .register(
      AuthenticateHandler,
      (c) => new AuthenticateHandler(c.get(Argon2Adapter), c.get(SessionsAdapter)),
    )
    .register(AuthenticateEndpoint, (c) => new AuthenticateEndpoint(c.get(AuthenticateHandler)))
    .register(RenewHandler, (c) => new RenewHandler(c.get(SessionsAdapter)))
    .register(RenewEndpoint, (c) => new RenewEndpoint(c.get(RenewHandler)))
    .register(KeyWrapAdapter, () => new KeyWrapAdapter())
    .register(TokenStoreAdapter, (c) => new TokenStoreAdapter(c.get(FileSystem)))
    .register(
      GenerateAccessTokenHandler,
      (c) =>
        new GenerateAccessTokenHandler(
          c.get(SessionsAdapter),
          c.get(KeyWrapAdapter),
          c.get(TokenStoreAdapter),
        ),
    )
    .register(
      LoadAccessTokenHandler,
      (c) => new LoadAccessTokenHandler(c.get(TokenStoreAdapter)),
    )
    .register(
      RevokeAccessTokenHandler,
      (c) => new RevokeAccessTokenHandler(c.get(TokenStoreAdapter)),
    )
    .register(
      GenerateTokenEndpoint,
      (c) => new GenerateTokenEndpoint(c.get(GenerateAccessTokenHandler)),
    )
    .register(
      CurrentTokenEndpoint,
      (c) => new CurrentTokenEndpoint(c.get(LoadAccessTokenHandler)),
    )
    .register(
      RevokeTokenEndpoint,
      (c) => new RevokeTokenEndpoint(c.get(RevokeAccessTokenHandler)),
    )
    .build();
}

const silentLogger: Logger = {
  info: async () => {},
  warn: async () => {},
  error: async () => {},
};

/**
 * Builds an in-process Client wired to a Server with the full auth catalog
 * registered. Endpoint integration tests use this to exercise the JSON-RPC
 * envelope, method routing and error mapping without spawning a subprocess.
 */
export function buildClient(container: Container): Client {
  const stubAuthentication = {
    check: () => ({
      sessionId: "stub",
      key: "x".repeat(64),
      expiresAt: new Date(Date.now() + 60_000),
    }),
  };
  const server = new Server(
    EndpointRegistry.empty(stubAuthentication)
      .public(container.get(ConfiguredEndpoint))
      .public(container.get(ConfigureEndpoint))
      .public(container.get(AuthenticateEndpoint))
      .public(container.get(RenewEndpoint))
      .public(container.get(ResourcesEndpoint))
      .protected(container.get(GenerateTokenEndpoint))
      .protected(container.get(CurrentTokenEndpoint))
      .protected(container.get(RevokeTokenEndpoint)),
    silentLogger,
    "test-core",
  );
  return new Client((request) => server.handle(request));
}
