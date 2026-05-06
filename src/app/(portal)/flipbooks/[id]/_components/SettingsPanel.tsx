"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ProjectSettings } from "@/lib/flipbook/types";

type Props = {
  flipbookId: string;
  open: boolean;
  onClose: () => void;
  settings: ProjectSettings;
};

export default function SettingsPanel({
  flipbookId,
  open,
  onClose,
  settings,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);

  const update = async (patch: Partial<ProjectSettings>) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/flipbooks/${flipbookId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: patch }),
      });
      if (!res.ok) throw new Error(`PATCH failed: ${res.status}`);
      startTransition(() => router.refresh());
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div
        className={`fixed inset-0 z-30 bg-black/20 transition-opacity ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={`fixed inset-y-0 right-0 z-40 flex w-80 flex-col border-l border-zinc-200 bg-white shadow-xl transition-transform ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!open}
      >
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-200 px-4">
          <h2 className="text-sm font-semibold text-zinc-900">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
            aria-label="Close settings"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-5">
          <Section title="Display">
            <RadioGroup
              label="Page layout"
              value={settings.displayMode}
              onChange={(v) => update({ displayMode: v })}
              options={[
                { value: "double", label: "Two-page spread" },
                { value: "single", label: "Single page" },
              ]}
              disabled={saving}
            />
            <Toggle
              label="Show cover as single page"
              checked={settings.showCover}
              onChange={(v) => update({ showCover: v })}
              disabled={saving}
            />
          </Section>

          <Section title="Reader controls">
            <Toggle
              label="Keyboard navigation (← →)"
              checked={settings.allowKeyboardNav}
              onChange={(v) => update({ allowKeyboardNav: v })}
              disabled={saving}
            />
            <Toggle
              label="Allow PDF download"
              checked={settings.allowDownload}
              onChange={(v) => update({ allowDownload: v })}
              disabled={saving}
            />
          </Section>

          {saving || pending ? (
            <p className="mt-4 text-xs text-zinc-400">Saving…</p>
          ) : null}
        </div>
      </aside>
    </>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6">
      <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-400">
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm text-zinc-700">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
          checked ? "bg-zinc-900" : "bg-zinc-300"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </button>
    </label>
  );
}

function RadioGroup<T extends string>({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  disabled?: boolean;
}) {
  return (
    <div>
      <div className="mb-2 text-sm text-zinc-700">{label}</div>
      <div className="grid grid-cols-2 gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={`rounded-md border px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50 ${
              value === opt.value
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
