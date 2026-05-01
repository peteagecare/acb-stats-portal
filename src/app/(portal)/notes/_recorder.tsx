"use client";

import { useEffect, useRef, useState } from "react";
import { DeepgramClient } from "@deepgram/sdk";

type DgSocket = Awaited<ReturnType<DeepgramClient["listen"]["v1"]["connect"]>>;

interface SummaryResult {
  overview: string;
  minutes: string[];
  tasks: { title: string; ownerLabel?: string | null; dueDate?: string | null }[];
}

interface RecorderProps {
  noteId: string;
  /** Called once when recording starts so the page can mark the body insertion point. */
  onLiveStart?: () => void;
  /** Called for each finalised transcript chunk so the page can append it to the editor body live. */
  onLiveChunk?: (text: string) => void;
  /** Called when the user accepts the summary. Page should: replace the live transcript paragraphs in the body
   *  with the summary HTML, persist the full transcript via PATCH, and refresh tasks. */
  onApply: (opts: { summaryHtml: string; fullTranscript: string; createdTaskIds: string[] }) => void;
}

export function MeetingRecorder({ noteId, onLiveStart, onLiveChunk, onApply }: RecorderProps) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [finalText, setFinalText] = useState("");
  const [interimText, setInterimText] = useState("");
  const [liveOk, setLiveOk] = useState(false); // toggles to true once Deepgram delivers any transcript
  const [liveError, setLiveError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SummaryResult | null>(null);
  const [summarising, setSummarising] = useState(false);
  const [createdTaskIds, setCreatedTaskIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const dgConnectionRef = useRef<DgSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioMimeRef = useRef<string>("audio/webm");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const shouldRecordRef = useRef(false);
  const finalTextRef = useRef("");
  const interimTextRef = useRef("");
  const liveOkRef = useRef(false);
  const lastSpeakerRef = useRef<number | null>(null);

  useEffect(() => {
    const ok = typeof window !== "undefined"
      && typeof MediaRecorder !== "undefined"
      && !!navigator.mediaDevices?.getUserMedia;
    setSupported(ok);
  }, []);

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [finalText, interimText]);

  async function startRecording() {
    setError(null);
    setSummary(null);
    setCreatedTaskIds([]);
    setFinalText("");
    setInterimText("");
    finalTextRef.current = "";
    interimTextRef.current = "";
    setLiveOk(false);
    liveOkRef.current = false;
    lastSpeakerRef.current = null;
    setLiveError(null);
    setElapsed(0);
    audioChunksRef.current = [];

    if (typeof window !== "undefined" && window.isSecureContext === false) {
      setError(`Insecure URL (${window.location.host}). Open via http://localhost:3000.`);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser doesn't expose getUserMedia.");
      return;
    }

    let dgToken: string;
    let dgScheme: "bearer" | "token" = "token";
    try {
      const tokRes = await fetch("/api/transcribe/token", { method: "POST" });
      const tokBody = await tokRes.json();
      if (!tokRes.ok) throw new Error(tokBody.error ?? `HTTP ${tokRes.status}`);
      dgToken = tokBody.token;
      dgScheme = tokBody.scheme === "bearer" ? "bearer" : "token";
    } catch (err) {
      setError(`Couldn't get transcription token: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      const name = (err as { name?: string })?.name ?? "unknown";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setError("Microphone access denied. Allow it in your browser site settings and try again.");
      } else if (name === "NotFoundError") {
        setError("No microphone detected.");
      } else {
        setError(`getUserMedia failed (${name}).`);
      }
      return;
    }
    audioStreamRef.current = stream;

    // MediaRecorder ALWAYS captures the full audio to a Blob, regardless of
    // whether Deepgram streaming succeeds. If streaming fails or never delivers,
    // we use the captured Blob for post-recording transcription via /api/transcribe.
    const mimeCandidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
    const mimeType = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
    audioMimeRef.current = mimeType || "audio/webm";
    const mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size === 0) return;
      audioChunksRef.current.push(e.data);
      // Also forward to the live Deepgram socket if it's open
      if (dgConnectionRef.current) {
        e.data.arrayBuffer().then((buf) => {
          try { dgConnectionRef.current?.sendMedia(buf); } catch { /* ignore */ }
        });
      }
    };

    mediaRecorder.onstop = async () => {
      audioStreamRef.current?.getTracks().forEach((t) => t.stop());
      audioStreamRef.current = null;
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      setRecording(false);

      // Close the streaming socket
      if (dgConnectionRef.current) {
        try { dgConnectionRef.current.sendCloseStream({ type: "CloseStream" }); } catch { /* ignore */ }
        try { dgConnectionRef.current.close(); } catch { /* ignore */ }
        dgConnectionRef.current = null;
      }

      // If live captured something usable, we're done
      if (liveOkRef.current && finalTextRef.current.trim().length > 0) {
        // Flush any trailing interim into final
        if (interimTextRef.current) {
          finalTextRef.current = `${finalTextRef.current} ${interimTextRef.current}`.trim();
          setFinalText(finalTextRef.current);
        }
        interimTextRef.current = "";
        setInterimText("");
        return;
      }

      // Otherwise: post-recording fallback via REST
      const chunks = audioChunksRef.current;
      audioChunksRef.current = [];
      if (chunks.length === 0) {
        setError("No audio captured.");
        return;
      }
      const blob = new Blob(chunks, { type: audioMimeRef.current });
      setTranscribing(true);
      try {
        const res = await fetch("/api/transcribe", {
          method: "POST",
          headers: { "Content-Type": blob.type || "audio/webm" },
          body: blob,
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
        finalTextRef.current = body.transcript ?? "";
        setFinalText(finalTextRef.current);
        if (!body.transcript) {
          setError("Deepgram returned an empty transcript — make sure your microphone was picking up sound.");
        } else {
          // Mirror the live path: write the post-recording transcript into the note body
          // so the View Transcript / replace-with-summary flow works the same way.
          // Deepgram's `paragraphs.transcript` separates speaker turns with `\n\n`
          // and prefixes each with "Speaker N:" — split on that to get one paragraph per turn.
          onLiveStart?.();
          const turns = (body.transcript as string).split(/\n\s*\n/).map((t) => t.trim()).filter(Boolean);
          if (turns.length === 0) {
            onLiveChunk?.(body.transcript);
          } else {
            for (const turn of turns) onLiveChunk?.(turn);
          }
        }
      } catch (e) {
        setError(`Transcription failed: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setTranscribing(false);
      }
    };

    // Use a raw WebSocket — bypass the SDK so we see the actual close code.
    void dgScheme;
    const params = new URLSearchParams({
      model: "nova-2",
      smart_format: "true",
      interim_results: "true",
      endpointing: "300",
      punctuate: "true",
      diarize: "true",
    });
    const wsUrl = `wss://api.deepgram.com/v1/listen?${params}`;
    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl, ["token", dgToken]);
    } catch (e) {
      setLiveError(`couldn't construct WebSocket: ${e instanceof Error ? e.message : String(e)}`);
      ws = null as unknown as WebSocket;
    }

    let keepAliveTimer: ReturnType<typeof setInterval> | null = null;
    if (ws) {
      console.log("[dg] WebSocket created, waiting for open…");
      ws.onopen = () => {
        console.log("[dg] WebSocket OPEN");
        // Mark the body insertion point now, before any live chunks arrive
        onLiveStart?.();
        // Start MediaRecorder ONLY now — guarantees first chunk reaches Deepgram
        // immediately rather than being dropped while the WS was still CONNECTING.
        try {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state === "inactive") {
            mediaRecorderRef.current.start(250);
          }
        } catch (e) {
          setError(`MediaRecorder start failed: ${e instanceof Error ? e.message : String(e)}`);
        }
        // Send a KeepAlive every 5s to prevent Deepgram closing on idle.
        keepAliveTimer = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            try { ws.send(JSON.stringify({ type: "KeepAlive" })); } catch { /* ignore */ }
          }
        }, 5000);
      };

      ws.onmessage = (ev) => {
        let msg: {
          channel?: {
            alternatives?: {
              transcript?: string;
              words?: { word?: string; punctuated_word?: string; speaker?: number }[];
            }[];
          };
          is_final?: boolean;
          type?: string;
        };
        try { msg = JSON.parse(ev.data as string); } catch { return; }
        const alt = msg.channel?.alternatives?.[0];
        const transcript = alt?.transcript;
        if (!transcript) return;
        liveOkRef.current = true;
        setLiveOk(true);
        if (msg.is_final) {
          // Group consecutive words by speaker so each turn becomes its own paragraph.
          const words = alt?.words ?? [];
          const segments: { speaker: number; text: string }[] = [];
          if (words.length > 0) {
            for (const w of words) {
              const speaker = w.speaker ?? 0;
              const word = w.punctuated_word ?? w.word ?? "";
              if (segments.length === 0 || segments[segments.length - 1].speaker !== speaker) {
                segments.push({ speaker, text: word });
              } else {
                segments[segments.length - 1].text += " " + word;
              }
            }
          } else {
            segments.push({ speaker: lastSpeakerRef.current ?? 0, text: transcript.trim() });
          }
          for (const seg of segments) {
            // Only label when the speaker changes vs. the previous chunk
            const labelled = seg.speaker !== lastSpeakerRef.current
              ? `Speaker ${seg.speaker + 1}: ${seg.text}`
              : seg.text;
            lastSpeakerRef.current = seg.speaker;
            finalTextRef.current = finalTextRef.current
              ? `${finalTextRef.current}\n${labelled}`
              : labelled;
            onLiveChunk?.(labelled);
          }
          setFinalText(finalTextRef.current);
          interimTextRef.current = "";
          setInterimText("");
        } else {
          interimTextRef.current = transcript;
          setInterimText(transcript);
        }
      };

      ws.onerror = (e) => { console.log("[dg] ws error:", e); };

      ws.onclose = (ev) => {
        console.log("[dg] ws close:", ev.code, ev.reason);
        if (keepAliveTimer) { clearInterval(keepAliveTimer); keepAliveTimer = null; }
        if (!liveOkRef.current) {
          let hint = "";
          if (ev.code === 1006) hint = "1006 = abnormal closure, no handshake response. Auth was rejected before the connection even completed.";
          else if (ev.code === 1011) hint = "Server-side error from Deepgram.";
          else if (ev.code === 4000) hint = "Bad request — likely an invalid query parameter.";
          else if (ev.code === 4001) hint = "Authentication failed — API key invalid or lacks listen scope.";
          else if (ev.code === 4003) hint = "Insufficient permissions / forbidden.";
          else if (ev.code === 4008) hint = "Rate limit hit.";
          else if (ev.code === 4009) hint = "Insufficient credits / quota.";
          else if (ev.code === 1000) hint = "Server closed cleanly without any transcripts — usually means audio format/codec wasn't accepted, or no audio reached the server in time.";
          setLiveError(`code ${ev.code}${ev.reason ? ` "${ev.reason}"` : ""}. ${hint}`);
        }
      };

      // Hook the WS into the audio data pipe via a separate ref-style closure
      const sendToDg = (buf: ArrayBuffer) => {
        if (ws.readyState === WebSocket.OPEN) {
          try { ws.send(buf); } catch { /* ignore */ }
        }
      };

      // Replace the dataavailable handler so it ALSO routes to the raw WS
      let chunkCount = 0;
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size === 0) return;
        audioChunksRef.current.push(e.data);
        chunkCount++;
        if (chunkCount <= 3) console.log("[dg] chunk", chunkCount, e.data.size, "bytes, ws state:", ws.readyState);
        e.data.arrayBuffer().then(sendToDg);
      };

      // Closing the WS on stop (instead of via dgConnectionRef which the SDK used)
      const originalOnstop = mediaRecorder.onstop;
      mediaRecorder.onstop = (ev) => {
        try { ws.send(JSON.stringify({ type: "CloseStream" })); } catch { /* ignore */ }
        try { ws.close(1000, "client stop"); } catch { /* ignore */ }
        if (originalOnstop) originalOnstop.call(mediaRecorder, ev);
      };
    }

    // If we got a WS, MediaRecorder is started inside ws.onopen so the first
    // chunk reaches Deepgram immediately. Otherwise (no WS), start it now so
    // the post-recording fallback still captures audio.
    if (!ws) {
      try {
        mediaRecorder.start(250);
      } catch (e) {
        setError(`MediaRecorder start failed: ${e instanceof Error ? e.message : String(e)}`);
        audioStreamRef.current?.getTracks().forEach((t) => t.stop());
        audioStreamRef.current = null;
        return;
      }
    }

    shouldRecordRef.current = true;
    setRecording(true);
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
  }

  function stopRecording() {
    shouldRecordRef.current = false;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try { mediaRecorderRef.current.stop(); } catch { /* ignore */ }
    }
  }

  function discard() {
    shouldRecordRef.current = false;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try { mediaRecorderRef.current.stop(); } catch { /* ignore */ }
    }
    audioStreamRef.current?.getTracks().forEach((t) => t.stop());
    audioStreamRef.current = null;
    if (dgConnectionRef.current) {
      try { dgConnectionRef.current.close(); } catch { /* ignore */ }
      dgConnectionRef.current = null;
    }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    audioChunksRef.current = [];
    finalTextRef.current = "";
    interimTextRef.current = "";
    liveOkRef.current = false;
    setRecording(false);
    setTranscribing(false);
    setFinalText("");
    setInterimText("");
    setLiveOk(false);
    setSummary(null);
    setCreatedTaskIds([]);
    setError(null);
    setElapsed(0);
    setOpen(false);
  }

  async function generateSummary() {
    setSummarising(true);
    setError(null);
    try {
      const res = await fetch(`/api/notes/${noteId}/summarise`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: finalText, createTasks: true }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      setSummary(j.summary);
      setCreatedTaskIds(j.createdTaskIds ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSummarising(false);
    }
  }

  function applyToNote() {
    if (!summary) return;
    const overview = `<p><strong>Summary:</strong> ${escapeHtml(summary.overview)}</p>`;
    const minutes = summary.minutes.length > 0
      ? `<p><strong>Minutes:</strong></p><ul>${summary.minutes.map((m) => `<li>${escapeHtml(m)}</li>`).join("")}</ul>`
      : "";
    const tasks = summary.tasks.length > 0
      ? `<p><strong>Action items:</strong></p><ul>${summary.tasks.map((t) => {
          const owner = t.ownerLabel ? ` (<em>${escapeHtml(t.ownerLabel)}</em>)` : "";
          const due = t.dueDate ? ` — due ${escapeHtml(t.dueDate)}` : "";
          return `<li>${escapeHtml(t.title)}${owner}${due}</li>`;
        }).join("")}</ul>`
      : "";
    onApply({ summaryHtml: `${overview}${minutes}${tasks}`, fullTranscript: finalText, createdTaskIds });
    setSummary(null);
    setFinalText("");
    setInterimText("");
    finalTextRef.current = "";
    interimTextRef.current = "";
    setOpen(false);
  }

  if (supported === false) {
    return (
      <button type="button" onClick={() => alert("Recording requires Chrome, Edge, or Safari 16+ with mic access.")} style={recordButtonStyle("disabled")}>
        <MicIcon /> Record meeting
      </button>
    );
  }

  if (!open && !recording && !transcribing && !finalText && !summary) {
    return (
      <button type="button" onClick={() => setOpen(true)} style={recordButtonStyle("idle")}>
        <span style={{ width: 6, height: 6, borderRadius: 999, background: "#ef4444", flexShrink: 0 }} />
        <MicIcon />
        Record meeting
      </button>
    );
  }

  return (
    <div style={{
      background: "var(--bg-card)",
      border: "1px solid var(--color-border)",
      borderRadius: 14,
      padding: 14,
      width: 480,
      maxWidth: "100%",
      boxShadow: "var(--shadow-card)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <span style={{
          width: 10, height: 10, borderRadius: 999,
          background: recording ? "#ef4444" : "var(--color-text-tertiary)",
          animation: recording ? "pulse 1.4s infinite" : "none",
        }} />
        <strong style={{ fontSize: 14, color: "var(--color-text-primary)" }}>
          {recording ? (liveOk ? "Recording (live)" : "Recording…")
            : transcribing ? "Transcribing…"
            : summary ? "Summary ready"
            : finalText ? "Transcript ready"
            : "Ready to record"}
        </strong>
        {(recording || finalText) && (
          <span style={{ fontSize: 12, color: "var(--color-text-tertiary)", fontVariantNumeric: "tabular-nums" }}>
            {fmtElapsed(elapsed)}
          </span>
        )}
        <button type="button" onClick={discard} style={{ marginLeft: "auto", background: "transparent", border: "none", color: "var(--color-text-secondary)", cursor: "pointer", fontSize: 18, padding: 4 }} aria-label="Close">×</button>
      </div>

      {!recording && !transcribing && !finalText && !summary && (
        <button type="button" onClick={startRecording} style={primaryAction()}>
          <MicIcon /> Start recording
        </button>
      )}

      {recording && (
        <button type="button" onClick={stopRecording} style={{ ...primaryAction(), background: "#ef4444" }}>
          ⏹ Stop {liveOk ? "" : "& transcribe"}
        </button>
      )}

      {recording && !liveOk && liveError && (
        <div style={{ marginTop: 8, fontSize: 11, color: "var(--color-text-tertiary)" }}>
          Live transcription unavailable — full transcript will be generated when you stop.
          <div style={{ marginTop: 4, color: "#b91c1c" }}>Reason: {liveError}</div>
        </div>
      )}

      {transcribing && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", fontSize: 13, color: "var(--color-text-secondary)" }}>
          <span style={{ width: 14, height: 14, borderRadius: 999, border: "2px solid var(--color-accent)", borderTopColor: "transparent", animation: "spin 800ms linear infinite" }} />
          Sending audio to Deepgram for transcription…
        </div>
      )}

      {/* While recording with live working, finalised text is written straight into
          the note body — show only the interim "words being spoken" preview here
          for that live-typing feel. After stop / before live works, fall back to
          showing the full captured text so the user has somewhere to see it. */}
      {recording && liveOk && interimText && (
        <div ref={transcriptRef} style={{
          marginTop: 10, padding: "8px 12px",
          background: "rgba(0,0,0,0.025)", borderRadius: 10,
          fontSize: 12, color: "var(--color-text-tertiary)", fontStyle: "italic",
          maxHeight: 60, overflowY: "auto", lineHeight: 1.5,
        }}>
          {interimText}
        </div>
      )}
      {!recording && finalText && !transcribing && (
        <div ref={transcriptRef} style={{
          marginTop: 10, padding: 12,
          background: "rgba(0,0,0,0.025)", borderRadius: 10,
          fontSize: 13, color: "var(--color-text-primary)",
          maxHeight: 220, overflowY: "auto", lineHeight: 1.5, whiteSpace: "pre-wrap",
        }}>
          {finalText}
        </div>
      )}

      {finalText && !summary && !transcribing && !recording && (
        <button type="button" onClick={generateSummary} disabled={summarising} style={{ ...primaryAction(), marginTop: 10 }}>
          {summarising ? "Generating summary…" : "✨ Generate summary & tasks"}
        </button>
      )}

      {summary && (
        <div style={{ marginTop: 12 }}>
          <div style={sectionLabel}>Overview</div>
          <div style={{ fontSize: 13, marginBottom: 12, color: "var(--color-text-primary)", lineHeight: 1.5 }}>{summary.overview}</div>

          {summary.minutes.length > 0 && (
            <>
              <div style={sectionLabel}>Minutes</div>
              <ul style={summaryList}>
                {summary.minutes.map((m, i) => <li key={i} style={{ marginBottom: 4 }}>{m}</li>)}
              </ul>
            </>
          )}

          {summary.tasks.length > 0 && (
            <>
              <div style={sectionLabel}>
                {summary.tasks.length} action item{summary.tasks.length === 1 ? "" : "s"}{createdTaskIds.length > 0 ? ` · saved to note` : ""}
              </div>
              <ul style={summaryList}>
                {summary.tasks.map((t, i) => (
                  <li key={i} style={{ marginBottom: 4 }}>
                    {t.title}
                    {t.ownerLabel && <span style={{ color: "var(--color-text-secondary)" }}> · {t.ownerLabel}</span>}
                    {t.dueDate && <span style={{ color: "var(--color-text-secondary)" }}> · {t.dueDate}</span>}
                  </li>
                ))}
              </ul>
            </>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button type="button" onClick={applyToNote} style={primaryAction()}>Insert into note</button>
            <button type="button" onClick={() => setSummary(null)} style={secondaryAction()}>Discard</button>
          </div>
        </div>
      )}

      {error && (
        <div style={{ marginTop: 10, padding: 8, background: "rgba(220,38,38,0.08)", borderRadius: 8, color: "#991b1b", fontSize: 12, whiteSpace: "pre-line", lineHeight: 1.5 }}>
          {error}
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.3); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

const sectionLabel: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: "var(--color-text-tertiary)",
  textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4,
};

const summaryList: React.CSSProperties = {
  marginTop: 0, marginBottom: 12, paddingLeft: 18,
  fontSize: 13, color: "var(--color-text-primary)",
};

function fmtElapsed(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function recordButtonStyle(state: "idle" | "disabled"): React.CSSProperties {
  const disabled = state === "disabled";
  return {
    display: "inline-flex", alignItems: "center", gap: 8,
    padding: "6px 12px", borderRadius: 8,
    background: "var(--bg-card)",
    color: disabled ? "var(--color-text-tertiary)" : "var(--color-text-primary)",
    border: "1px solid var(--color-border)",
    fontSize: 12, fontWeight: 500,
    cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "inherit",
    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
    transition: "background 120ms var(--ease-apple), border-color 120ms var(--ease-apple)",
  };
}

function MicIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10v2a7 7 0 0 0 14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  );
}

function primaryAction(): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
    padding: "9px 16px", borderRadius: 10,
    background: "var(--color-accent)", color: "white",
    border: "none", fontSize: 13, fontWeight: 600,
    cursor: "pointer", fontFamily: "inherit",
  };
}

function secondaryAction(): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
    padding: "9px 16px", borderRadius: 10,
    background: "transparent", color: "var(--color-text-primary)",
    border: "1px solid var(--color-border)", fontSize: 13, fontWeight: 500,
    cursor: "pointer", fontFamily: "inherit",
  };
}
