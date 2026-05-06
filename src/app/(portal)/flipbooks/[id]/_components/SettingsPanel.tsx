"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  type LeadField,
  type LeadFieldType,
  type LeadGate,
  type ProjectSettings,
} from "@/lib/flipbook/types";

type Props = {
  flipbookId: string;
  open: boolean;
  onClose: () => void;
  settings: ProjectSettings;
  leadGate: LeadGate;
  pageCount: number;
};

export default function SettingsPanel({
  flipbookId,
  open,
  onClose,
  settings,
  leadGate,
  pageCount,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [draftGate, setDraftGate] = useState<LeadGate>(leadGate);
  const [gateError, setGateError] = useState<string | null>(null);
  const [gateSaved, setGateSaved] = useState(false);

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

  const saveGate = async () => {
    setGateError(null);
    setGateSaved(false);
    setSaving(true);
    try {
      const res = await fetch(`/api/flipbooks/${flipbookId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadGate: draftGate }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setGateError(data.error || `PATCH failed: ${res.status}`);
        return;
      }
      setGateSaved(true);
      setTimeout(() => setGateSaved(false), 1500);
      startTransition(() => router.refresh());
    } catch (err) {
      setGateError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const updateField = (idx: number, patch: Partial<LeadField>) => {
    setDraftGate((g) => ({
      ...g,
      fields: g.fields.map((f, i) => (i === idx ? { ...f, ...patch } : f)),
    }));
  };

  const addField = () => {
    setDraftGate((g) => ({
      ...g,
      fields: [
        ...g.fields,
        {
          key: `field${g.fields.length + 1}`,
          label: "New field",
          type: "text",
          required: false,
        },
      ],
    }));
  };

  const removeField = (idx: number) => {
    setDraftGate((g) => ({
      ...g,
      fields: g.fields.filter((_, i) => i !== idx),
    }));
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
        className={`fixed inset-y-0 right-0 z-40 flex w-96 flex-col border-l border-zinc-200 bg-white shadow-xl transition-transform ${
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

          <Section title="Lead capture">
            <Toggle
              label="Enable lead capture"
              checked={draftGate.enabled}
              onChange={(v) => setDraftGate((g) => ({ ...g, enabled: v }))}
              disabled={saving}
            />
            {draftGate.enabled ? (
              <>
                <NumberInput
                  label={`Show on page (1–${pageCount})`}
                  value={draftGate.atPage}
                  min={1}
                  max={Math.max(1, pageCount)}
                  onChange={(v) => setDraftGate((g) => ({ ...g, atPage: v }))}
                  disabled={saving}
                />
                <Toggle
                  label="Allow reader to dismiss"
                  checked={draftGate.dismissible}
                  onChange={(v) =>
                    setDraftGate((g) => ({ ...g, dismissible: v }))
                  }
                  disabled={saving}
                />
                <TextInput
                  label="Headline"
                  value={draftGate.headline}
                  onChange={(v) =>
                    setDraftGate((g) => ({ ...g, headline: v }))
                  }
                  disabled={saving}
                />
                <TextArea
                  label="Subhead"
                  value={draftGate.subhead}
                  onChange={(v) =>
                    setDraftGate((g) => ({ ...g, subhead: v }))
                  }
                  disabled={saving}
                />
                <TextInput
                  label="Submit button label"
                  value={draftGate.buttonLabel}
                  onChange={(v) =>
                    setDraftGate((g) => ({ ...g, buttonLabel: v }))
                  }
                  disabled={saving}
                />

                <div className="mt-2">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-zinc-700">
                      Form fields
                    </span>
                    <button
                      type="button"
                      onClick={addField}
                      disabled={saving || draftGate.fields.length >= 10}
                      className="text-xs font-medium text-zinc-600 hover:text-zinc-900 disabled:opacity-50"
                    >
                      + Add field
                    </button>
                  </div>
                  <div className="space-y-3">
                    {draftGate.fields.map((field, idx) => (
                      <div
                        key={idx}
                        className="rounded-md border border-zinc-200 bg-zinc-50 p-3"
                      >
                        <div className="grid grid-cols-2 gap-2">
                          <MiniInput
                            label="Key"
                            value={field.key}
                            onChange={(v) => updateField(idx, { key: v })}
                            disabled={saving}
                            placeholder="firstName"
                          />
                          <MiniInput
                            label="Label"
                            value={field.label}
                            onChange={(v) => updateField(idx, { label: v })}
                            disabled={saving}
                            placeholder="First name"
                          />
                          <MiniSelect<LeadFieldType>
                            label="Type"
                            value={field.type}
                            onChange={(v) => updateField(idx, { type: v })}
                            disabled={saving}
                            options={[
                              { value: "text", label: "Text" },
                              { value: "email", label: "Email" },
                              { value: "tel", label: "Phone" },
                            ]}
                          />
                          <MiniInput
                            label="HubSpot name"
                            value={field.hubspotName ?? ""}
                            onChange={(v) =>
                              updateField(idx, {
                                hubspotName: v.length > 0 ? v : undefined,
                              })
                            }
                            disabled={saving}
                            placeholder="firstname"
                          />
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <label className="flex items-center gap-2 text-xs text-zinc-700">
                            <input
                              type="checkbox"
                              checked={field.required}
                              onChange={(e) =>
                                updateField(idx, { required: e.target.checked })
                              }
                              disabled={saving}
                            />
                            Required
                          </label>
                          <button
                            type="button"
                            onClick={() => removeField(idx)}
                            disabled={saving || draftGate.fields.length <= 1}
                            className="text-xs text-rose-600 hover:text-rose-800 disabled:opacity-40"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-3 space-y-3 border-t border-zinc-200 pt-3">
                  <p className="text-xs text-zinc-500">
                    Leave HubSpot fields blank to capture leads to the database
                    only.
                  </p>
                  <TextInput
                    label="HubSpot Portal ID"
                    value={draftGate.hubspotPortalId}
                    onChange={(v) =>
                      setDraftGate((g) => ({ ...g, hubspotPortalId: v }))
                    }
                    disabled={saving}
                    placeholder="12345678"
                  />
                  <TextInput
                    label="HubSpot Form GUID"
                    value={draftGate.hubspotFormGuid}
                    onChange={(v) =>
                      setDraftGate((g) => ({ ...g, hubspotFormGuid: v }))
                    }
                    disabled={saving}
                    placeholder="abcdefab-1234-..."
                  />
                </div>
              </>
            ) : null}

            <button
              type="button"
              onClick={saveGate}
              disabled={saving}
              className="mt-4 w-full rounded-md bg-zinc-900 px-3 py-2 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save lead capture settings"}
            </button>
            {gateError ? (
              <p className="mt-2 text-xs text-rose-600">{gateError}</p>
            ) : null}
            {gateSaved ? (
              <p className="mt-2 text-xs text-emerald-600">Saved.</p>
            ) : null}
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

function TextInput({
  label,
  value,
  onChange,
  disabled,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-zinc-700">
        {label}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className="w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs text-zinc-900 outline-none focus:border-zinc-900 disabled:bg-zinc-50"
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-zinc-700">
        {label}
      </span>
      <textarea
        value={value}
        rows={2}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full resize-none rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs text-zinc-900 outline-none focus:border-zinc-900 disabled:bg-zinc-50"
      />
    </label>
  );
}

function NumberInput({
  label,
  value,
  min,
  max,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm text-zinc-700">
      <span>{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          if (!Number.isNaN(n)) onChange(n);
        }}
        disabled={disabled}
        className="w-20 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 outline-none focus:border-zinc-900 disabled:bg-zinc-50"
      />
    </label>
  );
}

function MiniInput({
  label,
  value,
  onChange,
  disabled,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 outline-none focus:border-zinc-900 disabled:bg-zinc-50"
      />
    </label>
  );
}

function MiniSelect<T extends string>({
  label,
  value,
  onChange,
  disabled,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
  options: { value: T; label: string }[];
}) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        disabled={disabled}
        className="w-full rounded-md border border-zinc-300 bg-white px-1.5 py-1 text-xs text-zinc-900 outline-none focus:border-zinc-900 disabled:bg-zinc-50"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
