import { NextRequest } from "next/server";
import { parseSessionToken, AUTH_COOKIE_NAME } from "@/lib/auth";

export const config = {
  api: { bodyParser: false },
};

/** POST /api/transcribe
 *  Body: raw audio bytes (Content-Type: audio/webm | audio/mp4 | audio/wav)
 *  Forwards to Deepgram's pre-recorded /v1/listen endpoint with Nova-3
 *  and returns the transcript + word timings.
 *
 *  Pre-recorded REST is much more reliable than streaming: same auth path
 *  the rest of the API uses, no subprotocol negotiation, and accuracy is
 *  marginally better because the model has the whole utterance up front.
 */
export async function POST(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const user = parseSessionToken(token);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) return Response.json({ error: "DEEPGRAM_API_KEY not set" }, { status: 500 });

  const contentType = request.headers.get("content-type") ?? "audio/webm";
  const body = await request.arrayBuffer();
  if (body.byteLength === 0) {
    return Response.json({ error: "Empty audio body" }, { status: 400 });
  }
  if (body.byteLength > 100 * 1024 * 1024) {
    return Response.json({ error: "Audio too large (>100MB). Split into shorter recordings." }, { status: 413 });
  }

  const params = new URLSearchParams({
    model: "nova-3",
    smart_format: "true",
    punctuate: "true",
    paragraphs: "true",
    diarize: "true",
    utterances: "true",
  });

  const dgRes = await fetch(`https://api.deepgram.com/v1/listen?${params}`, {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": contentType,
    },
    body,
  });

  if (!dgRes.ok) {
    const txt = await dgRes.text();
    return Response.json(
      { error: `Deepgram transcription failed (${dgRes.status}): ${txt}` },
      { status: 502 },
    );
  }

  const data = await dgRes.json();
  const transcript: string =
    data?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "";
  const paragraphs: string =
    data?.results?.channels?.[0]?.alternatives?.[0]?.paragraphs?.transcript ?? "";
  const durationSec: number = data?.metadata?.duration ?? 0;

  return Response.json({
    transcript: paragraphs || transcript,
    durationSec,
  });
}
