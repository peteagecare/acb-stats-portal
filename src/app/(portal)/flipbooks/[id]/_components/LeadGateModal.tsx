"use client";

import { useEffect, useState } from "react";
import type { LeadGate } from "@/lib/flipbook/types";

type Props = {
  flipbookId: string;
  gate: LeadGate;
  open: boolean;
  onUnlock: () => void;
  onDismiss: () => void;
};

export default function LeadGateModal({
  flipbookId,
  gate,
  open,
  onUnlock,
  onDismiss,
}: Props) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setValues({});
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/flipbooks/${flipbookId}/lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Submission failed");
        setSubmitting(false);
        return;
      }
      onUnlock();
    } catch {
      setError("Network error — please try again");
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        {gate.dismissible ? (
          <button
            type="button"
            onClick={onDismiss}
            className="absolute right-3 top-3 rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
            aria-label="Close"
          >
            ✕
          </button>
        ) : null}
        <h2 className="pr-6 text-xl font-semibold text-zinc-900">
          {gate.headline}
        </h2>
        {gate.subhead ? (
          <p className="mt-2 text-sm text-zinc-600">{gate.subhead}</p>
        ) : null}

        <form onSubmit={submit} className="mt-5 space-y-3">
          {gate.fields.map((field) => (
            <label key={field.key} className="block">
              <span className="mb-1 block text-xs font-medium text-zinc-700">
                {field.label}
                {field.required ? <span className="text-rose-500"> *</span> : null}
              </span>
              <input
                type={field.type}
                required={field.required}
                value={values[field.key] ?? ""}
                onChange={(e) =>
                  setValues((v) => ({ ...v, [field.key]: e.target.value }))
                }
                disabled={submitting}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-900 focus:border-zinc-900 focus:ring-1 disabled:bg-zinc-50"
              />
            </label>
          ))}

          {error ? (
            <p className="text-sm text-rose-600">{error}</p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 w-full rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-60"
          >
            {submitting ? "Submitting…" : gate.buttonLabel}
          </button>
        </form>
      </div>
    </div>
  );
}
