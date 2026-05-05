"use client";

import { useEffect, useState } from "react";
import { Avatar, colorForEmail } from "../workspace/_shared";

interface User {
  email: string;
  label: string;
  role: string;
  createdAt: string;
  avatarUrl?: string;
}

interface NewUserResult {
  user: User;
  totpSecret: string;
  otpauthUrl: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[] | null>(null);
  const [email, setEmail] = useState("");
  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState<NewUserResult | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    void loadUsers();
  }, []);

  async function loadUsers() {
    setError(null);
    const res = await fetch("/api/admin/users");
    if (res.status === 403) {
      setForbidden(true);
      setUsers([]);
      return;
    }
    if (!res.ok) {
      setError("Failed to load users.");
      return;
    }
    const data = await res.json();
    setUsers(data.users ?? []);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), label: label.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to create user");
      setJustCreated(data as NewUserResult);
      setEmail("");
      setLabel("");
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setCreating(false);
    }
  }

  async function handleRemove(targetEmail: string) {
    if (!confirm(`Remove ${targetEmail}? They'll lose access immediately.`)) return;
    setRemoving(targetEmail);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to remove user");
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove user");
    } finally {
      setRemoving(null);
    }
  }

  if (forbidden) {
    return (
      <div style={{ padding: "28px 28px 48px", maxWidth: 900, margin: "0 auto" }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: "var(--color-text-primary)" }}>
          Users
        </h1>
        <div
          style={{
            marginTop: 20,
            background: "var(--bg-card)",
            borderRadius: "var(--radius-card)",
            boxShadow: "var(--shadow-card)",
            padding: 24,
            fontSize: 14,
            color: "var(--color-text-secondary)",
          }}
        >
          Only admins can manage users. Ask an admin to add or remove accounts for you.
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "28px 28px 48px", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--color-text-primary)" }}>
          Users
        </h1>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--color-text-secondary)" }}>
          Add people to the portal. New users get a one-time TOTP secret (shown once) plus a QR code to scan with Google Authenticator, 1Password, or similar.
        </p>
      </div>

      {/* Just-created banner */}
      {justCreated && (
        <div
          style={{
            background: "#FFFBEB",
            border: "1px solid #F59E0B",
            borderRadius: "var(--radius-card)",
            padding: 20,
            marginBottom: 16,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#92400E" }}>
                User created — save this TOTP secret now, it won&apos;t be shown again.
              </div>
              <div style={{ fontSize: 12, color: "#92400E", marginTop: 4 }}>
                Send the secret (or QR) to <strong>{justCreated.user.email}</strong> so they can finish logging in.
              </div>
            </div>
            <button
              onClick={() => setJustCreated(null)}
              style={{ background: "transparent", border: "none", color: "#92400E", fontSize: 18, cursor: "pointer", padding: 4 }}
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>

          <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 12, alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#92400E", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                TOTP secret
              </div>
              <div
                style={{
                  fontFamily: "ui-monospace, Menlo, monospace",
                  fontSize: 14,
                  background: "white",
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1px solid #F59E0B",
                  marginTop: 6,
                  wordBreak: "break-all",
                }}
              >
                {justCreated.totpSecret}
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(justCreated.totpSecret)}
                style={{
                  marginTop: 8,
                  background: "transparent",
                  border: "1px solid #F59E0B",
                  color: "#92400E",
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "4px 10px",
                  borderRadius: 999,
                  cursor: "pointer",
                }}
              >
                Copy secret
              </button>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#92400E", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                QR code
              </div>
              <img
                alt="TOTP QR code"
                src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(justCreated.otpauthUrl)}`}
                width={150}
                height={150}
                style={{ borderRadius: 10, background: "white", padding: 6, border: "1px solid #F59E0B" }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Add-user form */}
      <form
        onSubmit={handleCreate}
        style={{
          background: "var(--bg-card)",
          borderRadius: "var(--radius-card)",
          boxShadow: "var(--shadow-card)",
          padding: 22,
          marginBottom: 14,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--color-text-primary)" }}>Add a user</h2>
        <p style={{ margin: "4px 0 16px", fontSize: 12, color: "var(--color-text-secondary)" }}>
          New users are created with the <strong>viewer</strong> role.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10, alignItems: "end" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-primary)" }}>Name</span>
            <input
              type="text"
              placeholder="Sam Example"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
              style={inputStyle}
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-primary)" }}>Email</span>
            <input
              type="email"
              placeholder="sam@agecare-bathrooms.co.uk"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={inputStyle}
            />
          </label>

          <button
            type="submit"
            disabled={creating || !email || !label}
            style={{
              background: "var(--color-accent)",
              color: "white",
              border: "none",
              padding: "10px 18px",
              borderRadius: "var(--radius-button)",
              fontSize: 13,
              fontWeight: 600,
              cursor: creating ? "wait" : "pointer",
              opacity: creating || !email || !label ? 0.6 : 1,
              whiteSpace: "nowrap",
            }}
          >
            {creating ? "Creating…" : "Add user"}
          </button>
        </div>

        {error && (
          <div style={{ marginTop: 10, fontSize: 12, color: "#9E1A1E" }}>
            {error}
          </div>
        )}
      </form>

      {/* User list */}
      <div
        style={{
          background: "var(--bg-card)",
          borderRadius: "var(--radius-card)",
          boxShadow: "var(--shadow-card)",
          padding: 22,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--color-text-primary)" }}>
          Everyone with access {users ? `(${users.length})` : ""}
        </h2>

        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
          {users === null && <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>Loading…</div>}
          {users?.length === 0 && <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>No users yet.</div>}
          {users?.map((u) => (
            <div
              key={u.email}
              style={{
                display: "grid",
                gridTemplateColumns: "auto minmax(0, 1fr) auto auto auto",
                alignItems: "center",
                gap: 12,
                padding: "10px 14px",
                background: "#F9F9FB",
                borderRadius: 12,
              }}
            >
              <Avatar
                user={{
                  email: u.email,
                  label: u.label,
                  color: colorForEmail(u.email),
                  avatarUrl: u.avatarUrl,
                }}
                size={36}
              />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {u.label}
                </div>
                <div style={{ fontSize: 12, color: "var(--color-text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {u.email}
                </div>
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "3px 10px",
                  borderRadius: 999,
                  background: u.role === "admin" ? "rgba(0,113,227,0.1)" : "rgba(0,0,0,0.05)",
                  color: u.role === "admin" ? "var(--color-accent)" : "var(--color-text-secondary)",
                }}
              >
                {u.role}
              </span>
              <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>
                Added {new Date(u.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </span>
              {u.role !== "admin" ? (
                <button
                  onClick={() => handleRemove(u.email)}
                  disabled={removing === u.email}
                  style={{
                    background: "transparent",
                    border: "1px solid rgba(217,61,66,0.35)",
                    color: "#9E1A1E",
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "4px 10px",
                    borderRadius: 999,
                    cursor: removing === u.email ? "wait" : "pointer",
                    opacity: removing === u.email ? 0.5 : 1,
                  }}
                >
                  {removing === u.email ? "Removing…" : "Remove"}
                </button>
              ) : (
                <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>Admin (locked)</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-button)",
  padding: "9px 12px",
  fontSize: 13,
  fontWeight: 500,
  color: "var(--color-text-primary)",
  background: "white",
  outline: "none",
  fontFamily: "inherit",
};
