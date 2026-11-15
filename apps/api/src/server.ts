import { createServer } from "node:http";
import { SupabaseJwtVerifier, type Membership } from "@agntia/identity";
import { createApp } from "./app.ts";
import { BrandingService } from "./service.ts";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(
      `[agntia-branding] missing ${name}. This service refuses to start without verified Supabase JWT configuration; there is no default issuer, audience or dev bypass.`,
    );
    process.exit(1);
  }
  return value;
}

const issuer = required("SUPABASE_ISSUER");
const audience = required("SUPABASE_AUDIENCE");
const jwksUrl = required("SUPABASE_JWKS_URL");
const port = Number(process.env.PORT ?? 8787);

/** Memberships are provisioned server-side (database in production). */
function loadMemberships(): Membership[] {
  const raw = process.env.BRANDING_MEMBERSHIPS_JSON;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Membership[];
    if (!Array.isArray(parsed)) throw new Error("not an array");
    return parsed;
  } catch {
    console.error("[agntia-branding] BRANDING_MEMBERSHIPS_JSON is not a valid membership array");
    process.exit(1);
  }
}

const verifier = new SupabaseJwtVerifier({ issuer, audience, jwksUrl });
const app = createApp({ verifier, memberships: loadMemberships(), service: new BrandingService() });

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (value) headers.set(key, Array.isArray(value) ? value.join(",") : value);
  }

  let body: Buffer | undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    body = Buffer.concat(chunks);
  }

  const webResponse = await app.fetch(
    new Request(url, {
      method: request.method,
      headers,
      body,
      ...(body ? { duplex: "half" } : {}),
    } as RequestInit),
  );

  response.statusCode = webResponse.status;
  webResponse.headers.forEach((value, key) => response.setHeader(key, value));
  response.end(Buffer.from(await webResponse.arrayBuffer()));
});

server.listen(port, "0.0.0.0", () => {
  console.log(`[agntia-branding] listening on 0.0.0.0:${port}`);
});
