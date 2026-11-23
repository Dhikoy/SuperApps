import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createSuperAppsMcp } from "@/lib/mcp/server";
import { mcpUnauthorized, sessionFromMcpRequest } from "@/lib/mcp/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-superapps-mcp-key, mcp-session-id, mcp-protocol-version, Last-Event-ID",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
};

function withCors(response: Response) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(cors)) headers.set(key, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function handle(request: Request) {
  const session = await sessionFromMcpRequest(request);
  if (!session) return mcpUnauthorized();

  const server = createSuperAppsMcp(session);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  const response = await transport.handleRequest(request);
  return withCors(response);
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: cors });
}

export function GET(request: Request) {
  return handle(request);
}

export function POST(request: Request) {
  return handle(request);
}

export function DELETE(request: Request) {
  return handle(request);
}
