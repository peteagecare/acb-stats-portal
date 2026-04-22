import Link from "next/link";

export default function PendingPage({
  title,
  description,
  anchor,
}: {
  title: string;
  description: string;
  anchor?: string;
}) {
  const overviewHref = anchor ? `/overview#${anchor}` : "/overview";
  return (
    <div style={{ padding: "28px 28px 48px", maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--color-text-primary)" }}>
        {title}
      </h1>
      <p style={{ margin: "6px 0 22px", fontSize: 13, color: "var(--color-text-secondary)" }}>
        {description}
      </p>

      <div
        style={{
          background: "var(--bg-card)",
          borderRadius: "var(--radius-card)",
          boxShadow: "var(--shadow-card)",
          padding: 28,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: 14,
        }}
      >
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "4px 10px", borderRadius: 999, background: "rgba(232,131,58,0.12)", color: "#B56729", fontSize: 11, fontWeight: 600 }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: "#E8833A" }} />
          Moving soon
        </div>
        <div style={{ fontSize: 14, color: "var(--color-text-primary)", lineHeight: 1.5 }}>
          This section lives on the full overview page while we split it into its own view.
          The data and controls are the same — just scroll to the matching block.
        </div>
        <Link
          href={overviewHref}
          style={{
            marginTop: 4,
            background: "var(--color-accent)",
            color: "white",
            fontSize: 13,
            fontWeight: 500,
            padding: "10px 16px",
            borderRadius: "var(--radius-button)",
            textDecoration: "none",
          }}
        >
          Open on full overview →
        </Link>
      </div>
    </div>
  );
}
