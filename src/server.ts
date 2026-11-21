import { createServer as createHttpServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { DomainError, normalizeError } from "./contracts/errors.ts";

/**
 * Node HTTP adapter.
 *
 * The application is written against the Fetch types (Request/Response), which
 * is what makes it portable and testable without a socket. This module is the
 * only place that knows about `node:http`; it converts one to the other and
 * enforces the body limit before the application sees anything.
 */

const DEFAULT_MAX_BODY_BYTES = 262_144;

export interface NodeServerOptions {
  handle: (request: Request) => Promise<Response>;
  host: string;
  port: number;
  maxBodyBytes?: number;
}

export interface RunningServer {
  readonly server: Server;
  readonly url: string;
  readonly port: number;
  close: () => Promise<void>;
}

async function readBody(request: IncomingMessage, maxBytes: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
    size += buffer.byteLength;
    if (size > maxBytes) {
      throw new DomainError("invalid_input", "Request body is too large.", { details: { limit: maxBytes } });
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

/**
 * The origin is intentionally a fixed, unresolvable internal one: routing reads
 * only the path, and authorization must never depend on the Host header a client
 * sent.
 */
export async function toWebRequest(
  request: IncomingMessage,
  maxBodyBytes: number = DEFAULT_MAX_BODY_BYTES,
): Promise<Request> {
  const url = new URL(request.url ?? "/", "http://internal.invalid");
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) headers.append(name, item);
    } else {
      headers.set(name, value);
    }
  }

  const method = (request.method ?? "GET").toUpperCase();
  const sendsBody = method !== "GET" && method !== "HEAD";
  const body = sendsBody ? await readBody(request, maxBodyBytes) : undefined;
  return new Request(url.toString(), {
    method,
    headers,
    ...(body === undefined ? {} : { body: body.byteLength === 0 ? null : body }),
  });
}

async function writeResponse(response: ServerResponse, result: Response): Promise<void> {
  response.statusCode = result.status;
  result.headers.forEach((value, name) => response.setHeader(name, value));
  const body = Buffer.from(await result.arrayBuffer());
  response.setHeader("content-length", String(body.byteLength));
  response.end(body);
}

function writeInternalError(response: ServerResponse, error: unknown): void {
  const domainError = normalizeError(error);
  const body = JSON.stringify({
    error: {
      code: domainError.code,
      message: domainError.message,
      correlationId: "server",
      retryable: domainError.retryable,
      reconciliationRequired: domainError.reconciliationRequired,
      details: domainError.details,
    },
  });
  response.statusCode = domainError.status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  response.end(body);
}

export async function startServer(options: NodeServerOptions): Promise<RunningServer> {
  const maxBodyBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;

  const server = createHttpServer((request, response) => {
    void (async () => {
      try {
        const webRequest = await toWebRequest(request, maxBodyBytes);
        const webResponse = await options.handle(webRequest);
        await writeResponse(response, webResponse);
      } catch (error) {
        if (response.headersSent) {
          response.destroy();
          return;
        }
        writeInternalError(response, error);
      }
    })();
  });

  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error): void => reject(error);
    server.once("error", onError);
    server.listen(options.port, options.host, () => {
      server.off("error", onError);
      resolve();
    });
  });

  const address = server.address();
  const boundPort = typeof address === "object" && address !== null ? address.port : options.port;
  const displayHost = options.host === "0.0.0.0" || options.host === "::" ? "127.0.0.1" : options.host;

  return {
    server,
    port: boundPort,
    url: `http://${displayHost}:${boundPort}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections();
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}
