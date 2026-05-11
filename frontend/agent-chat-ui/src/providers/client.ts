import { Client } from "@langchain/langgraph-sdk";

/**
 * Create a LangGraph SDK client.
 *
 * When a Supabase JWT token is provided, it is sent as the
 * `Authorization: Bearer <token>` header so LangGraph Server
 * can authenticate the request via @auth.authenticate.
 */
export function createClient(
  apiUrl: string,
  apiKey: string | undefined,
  authScheme: string | undefined,
  supabaseToken?: string | null,
) {
  const headers: Record<string, string> = {};

  if (authScheme) {
    headers["X-Auth-Scheme"] = authScheme;
  }
  if (supabaseToken) {
    headers["Authorization"] = `Bearer ${supabaseToken}`;
  }

  return new Client({
    apiKey,
    apiUrl,
    ...(Object.keys(headers).length > 0 && { defaultHeaders: headers }),
  });
}
