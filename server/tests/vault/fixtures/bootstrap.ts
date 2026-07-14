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
import { Adapter as VaultsAdapter } from "@server/vault/outbound/persistence/file-system/adapter.ts";
import { CryptoAdapter } from "@server/vault/outbound/crypto/adapter.ts";
import { CreateVaultHandler } from "@server/vault/application/handlers/create-vault-handler.ts";
import { DeleteVaultHandler } from "@server/vault/application/handlers/delete-vault-handler.ts";
import { GenerateSecretHandler } from "@server/vault/application/handlers/generate-secret-handler.ts";
import { DeleteSecretHandler } from "@server/vault/application/handlers/delete-secret-handler.ts";
import { RetrieveSecretHandler } from "@server/vault/application/handlers/retrieve-secret-handler.ts";
import {
  CreateVaultEndpoint,
  DeleteSecretEndpoint,
  DeleteVaultEndpoint,
  GenerateSecretEndpoint,
  ListSecretsEndpoint,
  ListVaultsEndpoint,
  RetrieveSecretEndpoint,
} from "@server/vault/inbound/rpc/endpoints.ts";
import { Query as AllVaultsQuery } from "@server/vault/application/queries/all/query.ts";
import { Query as AllSecretsQuery } from "@server/vault/application/queries/secrets/all/query.ts";
import { Persistence } from "@tests/vault/integration/outbound/persistence.ts";

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
    .register(VaultsAdapter, (c) => new VaultsAdapter(c.get(FileSystem)))
    .register(CryptoAdapter, () => new CryptoAdapter())
    .register(StubAuthentication, () => new StubAuthentication())
    .register(CreateVaultHandler, (c) => new CreateVaultHandler(c.get(VaultsAdapter)))
    .register(DeleteVaultHandler, (c) => new DeleteVaultHandler(c.get(VaultsAdapter)))
    .register(
      GenerateSecretHandler,
      (c) => new GenerateSecretHandler(c.get(VaultsAdapter), c.get(CryptoAdapter)),
    )
    .register(DeleteSecretHandler, (c) => new DeleteSecretHandler(c.get(VaultsAdapter)))
    .register(
      RetrieveSecretHandler,
      (c) => new RetrieveSecretHandler(c.get(VaultsAdapter), c.get(CryptoAdapter)),
    )
    .register(AllVaultsQuery, (c) => new AllVaultsQuery(c.get(FileSystem)))
    .register(AllSecretsQuery, (c) => new AllSecretsQuery(c.get(FileSystem)))
    .register(CreateVaultEndpoint, (c) => new CreateVaultEndpoint(c.get(CreateVaultHandler)))
    .register(DeleteVaultEndpoint, (c) => new DeleteVaultEndpoint(c.get(DeleteVaultHandler)))
    .register(ListVaultsEndpoint, (c) => new ListVaultsEndpoint(c.get(AllVaultsQuery)))
    .register(
      GenerateSecretEndpoint,
      (c) => new GenerateSecretEndpoint(c.get(GenerateSecretHandler)),
    )
    .register(
      RetrieveSecretEndpoint,
      (c) => new RetrieveSecretEndpoint(c.get(RetrieveSecretHandler)),
    )
    .register(DeleteSecretEndpoint, (c) => new DeleteSecretEndpoint(c.get(DeleteSecretHandler)))
    .register(ListSecretsEndpoint, (c) => new ListSecretsEndpoint(c.get(AllSecretsQuery)))
    .build();
}

const silentLogger: Logger = {
  info: async () => {},
  warn: async () => {},
  error: async () => {},
};

/**
 * Builds an in-process Client wired to a Server with the full vault catalog
 * registered (every endpoint is protected — the StubAuthentication accepts
 * any sessionId and returns a fixed key). Endpoint integration tests use
 * this to exercise the JSON-RPC envelope, method routing, the Authenticated
 * decorator and error mapping without spawning a subprocess.
 */
export function buildClient(container: Container): Client {
  const server = new Server(
    EndpointRegistry.empty(container.get(StubAuthentication))
      .protected(container.get(CreateVaultEndpoint))
      .protected(container.get(DeleteVaultEndpoint))
      .protected(container.get(ListVaultsEndpoint))
      .protected(container.get(GenerateSecretEndpoint))
      .protected(container.get(RetrieveSecretEndpoint))
      .protected(container.get(DeleteSecretEndpoint))
      .protected(container.get(ListSecretsEndpoint)),
    silentLogger,
    "test-core",
  );
  return new Client((request) => server.handle(request));
}
