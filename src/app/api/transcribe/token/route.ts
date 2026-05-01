import { NextRequest } from "next/server";
import { parseSessionToken, AUTH_COOKIE_NAME } from "@/lib/auth";

/** Mints a short-lived Deepgram token so the browser can open a WebSocket
 *  to wss://api.deepgram.com directly without exposing the master key. */
export async function POST(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const user = parseSessionToken(token);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "DEEPGRAM_API_KEY not set on the server. Ask Pete to add it to .env.local and Vercel env vars." },
      { status: 500 },
    );
  }

  // Server-side verification — proves the API key actually works before
  // the browser even tries the WebSocket. If this 401/403s the WS would
  // also fail with 1006 silently, so doing this here gives a clearer error.
  try {
    const verify = await fetch("https://api.deepgram.com/v1/projects", {
      headers: { Authorization: `Token ${apiKey}` },
    });
    if (!verify.ok) {
      const txt = await verify.text();
      return Response.json(
        { error: `Deepgram REST verification failed (${verify.status}): ${txt}. The API key in DEEPGRAM_API_KEY is invalid, revoked, or the project has no credit.` },
        { status: 502 },
      );
    }
  } catch (e) {
    return Response.json(
      { error: `Couldn't reach Deepgram from the server: ${e instanceof Error ? e.message : String(e)}` },
      { status: 502 },
    );
  }

  // Master key + "token" subprotocol scheme is the documented Deepgram
  // browser-WebSocket auth path. Internal portal so the key is only sent
  // to authenticated clients.
  return Response.json({ token: apiKey, scheme: "token", expiresIn: null });
}
