"use client";

import Link from "next/link";
import NotificationsBell from "./NotificationsBell";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type NavItem = { href: string; label: string; icon: React.ReactNode };

const ICON_STYLE = { width: 18, height: 18, flexShrink: 0 } as const;

const Icon = {
  dashboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={ICON_STYLE}>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  ),
  funnel: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={ICON_STYLE}>
      <path d="M3 4h18l-7 9v7l-4-2v-5z" />
    </svg>
  ),
  teams: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={ICON_STYLE}>
      <circle cx="9" cy="8" r="3" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <path d="M15 20c0-2.2 1.8-4 4-4s2 1 2 2" />
    </svg>
  ),
  trends: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={ICON_STYLE}>
      <polyline points="3,17 9,11 13,15 21,7" />
      <polyline points="15,7 21,7 21,13" />
    </svg>
  ),
  visit: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={ICON_STYLE}>
      <path d="M12 2C8.1 2 5 5.1 5 9c0 5.3 7 13 7 13s7-7.7 7-13c0-3.9-3.1-7-7-7z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  ),
  install: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={ICON_STYLE}>
      <path d="M3 11l9-8 9 8" />
      <path d="M5 10v10h14V10" />
      <rect x="9" y="13" width="6" height="7" />
    </svg>
  ),
  feedback: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={ICON_STYLE}>
      <path d="M21 11.5a8.5 8.5 0 0 1-12.5 7.5L3 21l2-5.5A8.5 8.5 0 1 1 21 11.5z" />
    </svg>
  ),
  journey: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={ICON_STYLE}>
      <circle cx="5" cy="6" r="2" />
      <circle cx="19" cy="18" r="2" />
      <path d="M5 8c0 6 4 6 7 6s7 0 7 2" />
    </svg>
  ),
  timeline: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={ICON_STYLE}>
      <path d="M4 4v16" />
      <circle cx="4" cy="8" r="1.5" fill="currentColor" />
      <circle cx="4" cy="14" r="1.5" fill="currentColor" />
      <path d="M6 8h14" />
      <path d="M6 14h10" />
    </svg>
  ),
  reviews: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={ICON_STYLE}>
      <path d="M12 3l2.5 5.5 6 .6-4.5 4.2 1.3 6.1L12 16.8 6.7 19.4 8 13.3 3.5 9.1l6-.6z" />
    </svg>
  ),
  automation: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={ICON_STYLE}>
      <rect x="3" y="4" width="6" height="6" rx="1" />
      <rect x="15" y="4" width="6" height="6" rx="1" />
      <rect x="9" y="14" width="6" height="6" rx="1" />
      <path d="M6 10v2h12v2" />
    </svg>
  ),
  approvals: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={ICON_STYLE}>
      <path d="M6 2h9l5 5v15H6z" />
      <path d="M15 2v5h5" />
      <path d="M9 14l2 2 4-4" />
    </svg>
  ),
  subscriptions: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={ICON_STYLE}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18" />
      <path d="M7 15h4" />
    </svg>
  ),
  overview: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={ICON_STYLE}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3v18M3 12h18" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={ICON_STYLE}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={ICON_STYLE}>
      <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 00-3-3.87M15 3.13a4 4 0 010 7.75" />
    </svg>
  ),
  changes: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={ICON_STYLE}>
      <path d="M12 8v4l3 2" />
      <circle cx="12" cy="12" r="9" />
      <path d="M21 12a9 9 0 10-4 7.5" />
    </svg>
  ),
  workspace: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={ICON_STYLE}>
      <path d="M3 7l9-4 9 4-9 4z" />
      <path d="M3 12l9 4 9-4" />
      <path d="M3 17l9 4 9-4" />
    </svg>
  ),
  building: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={ICON_STYLE}>
      <rect x="4" y="3" width="16" height="18" rx="1.5" />
      <path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2" />
    </svg>
  ),
  chevron: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 12, height: 12, flexShrink: 0 }}>
      <polyline points="9,6 15,12 9,18" />
    </svg>
  ),
  notes: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={ICON_STYLE}>
      <path d="M5 4h11l3 3v13H5z" />
      <path d="M8 9h7M8 13h7M8 17h4" />
    </svg>
  ),
  logout: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={ICON_STYLE}>
      <path d="M15 17l5-5-5-5" />
      <path d="M20 12H9" />
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
    </svg>
  ),
};

const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: Icon.dashboard },
  { href: "/workspace", label: "Workspace", icon: Icon.workspace },
  { href: "/notes", label: "Meeting Notes", icon: Icon.notes },
  { href: "/funnel", label: "Customer Funnel", icon: Icon.funnel },
  { href: "/teams", label: "Contacts Per Team", icon: Icon.teams },
  { href: "/trends", label: "Trends & Lifecycle", icon: Icon.trends },
  { href: "/team-changes", label: "Team Changes", icon: Icon.changes },
  { href: "/site-visits", label: "Site Visits", icon: Icon.visit },
  { href: "/installs", label: "Installs", icon: Icon.install },
  { href: "/feedback", label: "Outreach Feedback", icon: Icon.feedback },
  { href: "/lead-timeline", label: "Lead Timeline", icon: Icon.timeline },
  { href: "/reviews-social", label: "Reviews & Social", icon: Icon.reviews },
  { href: "/automation-map", label: "Journeys & Automations", icon: Icon.automation },
  { href: "/financial-approvals", label: "Financial Approvals", icon: Icon.approvals },
  { href: "/subscriptions", label: "Subscriptions", icon: Icon.subscriptions },
];

const SECONDARY: NavItem[] = [
  { href: "/settings", label: "Settings", icon: Icon.settings },
  { href: "/users", label: "Users", icon: Icon.users },
  { href: "/overview", label: "Full Overview", icon: Icon.overview },
];

const KNOWN_USERS = [
  { email: "pete@agecare-bathrooms.co.uk", label: "Pete" },
  { email: "chris@agecare-bathrooms.co.uk", label: "Chris" },
  { email: "sam@agecare-bathrooms.co.uk", label: "Sam" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const dashboardView = searchParams.get("view") === "team" ? "team" : "mine";
  const onTaskDashboard = pathname === "/workspace";
  const [mobileOpen, setMobileOpen] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [viewAs, setViewAs] = useState<string | null>(null);
  const [showViewAs, setShowViewAs] = useState(false);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [projectsByCompany, setProjectsByCompany] = useState<Record<string, { id: string; name: string }[]>>({});

  useEffect(() => {
    fetch("/api/companies")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { companies?: { id: string; name: string }[] } | null) => {
        if (data?.companies) setCompanies(data.companies);
      })
      .catch(() => {});
  }, []);

  // Auto-expand company we're currently viewing
  useEffect(() => {
    const m = pathname.match(/^\/workspace\/([^/]+)/);
    if (m) {
      const companyId = m[1];
      setExpanded((prev) => prev.has(companyId) ? prev : new Set(prev).add(companyId));
    }
  }, [pathname]);

  // Fetch projects for expanded companies we haven't loaded yet
  useEffect(() => {
    for (const id of expanded) {
      if (projectsByCompany[id]) continue;
      fetch(`/api/projects?companyId=${id}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data: { projects?: { id: string; name: string }[] } | null) => {
          if (data?.projects) {
            setProjectsByCompany((prev) => ({ ...prev, [id]: data.projects! }));
          }
        })
        .catch(() => {});
    }
  }, [expanded, projectsByCompany]);

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { email?: string; role?: string; realEmail?: string; realRole?: string; impersonating?: boolean } | null) => {
        if (data?.impersonating && data.realEmail) {
          setEmail(data.realEmail);
          setRole(data.realRole ?? null);
          setViewAs(data.email ?? null);
        } else {
          setEmail(data?.email ?? null);
          setRole(data?.role ?? null);
        }
      })
      .catch(() => {});
  }, []);

  function handleViewAs(targetEmail: string | null) {
    setShowViewAs(false);
    fetch("/api/auth/view-as", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: targetEmail }),
    }).then(() => {
      setViewAs(targetEmail);
      // Reload so all pages pick up the new session
      window.location.reload();
    }).catch(() => {});
  }

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  };

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await fetch("/api/logout", { method: "POST" });
    } catch {
      // fall through and redirect anyway
    }
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      {/* Mobile top bar */}
      <div
        style={{
          display: "none",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          background: "#FFFFFF",
          borderBottom: "1px solid var(--color-border)",
          position: "sticky",
          top: 0,
          zIndex: 40,
        }}
        className="portal-mobile-bar"
      >
        <Link href="/" style={{ fontWeight: 600, fontSize: 15, color: "var(--color-text-primary)", textDecoration: "none" }}>
          Age Care Marketing Hub
        </Link>
        <button
          onClick={() => setMobileOpen((v) => !v)}
          style={{ background: "transparent", border: "none", padding: 6, cursor: "pointer", color: "var(--color-text-primary)" }}
          aria-label="Toggle menu"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
      </div>

      {/* Sidebar */}
      <aside
        data-mobile-open={mobileOpen}
        className="portal-sidebar"
        style={{
          width: 240,
          flexShrink: 0,
          background: "#FFFFFF",
          borderRight: "1px solid var(--color-border)",
          padding: "20px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 4,
          position: "sticky",
          top: 0,
          height: "100vh",
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", padding: "4px 6px 14px 10px", gap: 8 }}>
          <Link
            href="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flex: 1,
              minWidth: 0,
              textDecoration: "none",
              color: "var(--color-text-primary)",
            }}
            onClick={() => setMobileOpen(false)}
          >
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--color-accent)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
              A
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.1 }}>Age Care</div>
              <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>Marketing Hub</div>
            </div>
          </Link>
          <NotificationsBell />
        </div>

        <nav style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 4 }}>
          {NAV.map((item) => (
            <div key={item.href}>
              <SidebarLink
                item={item}
                active={isActive(item.href)}
                onClick={() => setMobileOpen(false)}
              />
              {item.href === "/workspace" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 2, marginLeft: 16, marginTop: 2, marginBottom: 2 }}>
                  <SidebarLink
                    item={{ href: "/workspace", label: "Task Dashboard", icon: Icon.dashboard }}
                    active={onTaskDashboard}
                    onClick={() => setMobileOpen(false)}
                    subdued
                  />
                  {onTaskDashboard && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 1, marginLeft: 16, marginBottom: 2 }}>
                      <Link
                        href="/workspace"
                        onClick={() => setMobileOpen(false)}
                        style={dashboardSubLinkStyle(dashboardView === "mine")}
                      >My tasks</Link>
                      <Link
                        href="/workspace?view=team"
                        onClick={() => setMobileOpen(false)}
                        style={dashboardSubLinkStyle(dashboardView === "team")}
                      >Team tasks</Link>
                    </div>
                  )}
                  {companies.map((c) => {
                    const isOpen = expanded.has(c.id);
                    const isActiveCompany = pathname === `/workspace/${c.id}` || pathname.startsWith(`/workspace/${c.id}/`);
                    const projects = projectsByCompany[c.id];
                    return (
                      <div key={c.id}>
                        <CompanyRow
                          name={c.name}
                          href={`/workspace/${c.id}`}
                          active={isActiveCompany}
                          expanded={isOpen}
                          onToggle={() => toggleExpanded(c.id)}
                          onNavigate={() => setMobileOpen(false)}
                          icon={Icon.building}
                          chevron={Icon.chevron}
                        />
                        {isOpen && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 1, marginLeft: 24, marginTop: 1, marginBottom: 2 }}>
                            {!projects && (
                              <div style={{ padding: "4px 10px", fontSize: 11, color: "var(--color-text-tertiary)", fontStyle: "italic" }}>
                                Loading…
                              </div>
                            )}
                            {projects && projects.length === 0 && (
                              <div style={{ padding: "4px 10px", fontSize: 11, color: "var(--color-text-tertiary)", fontStyle: "italic" }}>
                                No projects
                              </div>
                            )}
                            {projects && projects.map((p) => (
                              <Link
                                key={p.id}
                                href={`/workspace/${c.id}/${p.id}`}
                                onClick={() => setMobileOpen(false)}
                                style={{
                                  display: "block", padding: "5px 10px", borderRadius: 8,
                                  fontSize: 12, color: pathname === `/workspace/${c.id}/${p.id}` ? "var(--color-accent)" : "var(--color-text-secondary)",
                                  background: pathname === `/workspace/${c.id}/${p.id}` ? "rgba(0,113,227,0.08)" : "transparent",
                                  fontWeight: pathname === `/workspace/${c.id}/${p.id}` ? 600 : 400,
                                  textDecoration: "none",
                                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                                }}
                                onMouseEnter={(e) => { if (pathname !== `/workspace/${c.id}/${p.id}`) e.currentTarget.style.background = "rgba(0,0,0,0.035)"; }}
                                onMouseLeave={(e) => { if (pathname !== `/workspace/${c.id}/${p.id}`) e.currentTarget.style.background = "transparent"; }}
                              >
                                {p.name}
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </nav>

        <div style={{ marginTop: 18, padding: "0 10px 6px", fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", color: "var(--color-text-tertiary)", textTransform: "uppercase" }}>
          More
        </div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {SECONDARY.map((item) => (
            <SidebarLink
              key={item.href}
              item={item}
              active={isActive(item.href)}
              onClick={() => setMobileOpen(false)}
            />
          ))}
        </nav>

        <div style={{ marginTop: "auto", paddingTop: 16, borderTop: "1px solid var(--color-border)" }}>
          {email && (
            <div style={{ padding: "6px 10px 8px", fontSize: 11, color: "var(--color-text-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {email}
            </div>
          )}

          {/* View Hub As — admin only */}
          {role === "admin" && (
            <div style={{ padding: "0 10px 8px", position: "relative" }}>
              {viewAs && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "5px 8px", marginBottom: 4,
                  background: "#FFF8E7", border: "1px solid #F59E0B", borderRadius: 8,
                  fontSize: 11, color: "#92400E",
                }}>
                  <span style={{ fontWeight: 600 }}>Viewing as {KNOWN_USERS.find((u) => u.email === viewAs)?.label ?? viewAs}</span>
                  <button onClick={() => handleViewAs(null)}
                    style={{ marginLeft: "auto", background: "none", border: "none", color: "#92400E", cursor: "pointer", fontSize: 11, fontWeight: 600, padding: 0, textDecoration: "underline" }}>
                    Stop
                  </button>
                </div>
              )}
              <button
                onClick={() => setShowViewAs(!showViewAs)}
                style={{
                  display: "flex", alignItems: "center", gap: 8, width: "100%",
                  padding: "7px 8px", borderRadius: 8,
                  background: "transparent", border: "1px dashed var(--color-border)",
                  color: "var(--color-text-secondary)", fontSize: 11, fontWeight: 500,
                  cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                View Hub As...
              </button>
              {showViewAs && (
                <div style={{
                  position: "absolute", bottom: "100%", left: 10, right: 10, marginBottom: 4,
                  background: "white", borderRadius: 10, border: "1px solid var(--color-border)",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.12)", zIndex: 50, overflow: "hidden",
                }}>
                  <div style={{ padding: "8px 10px 4px", fontSize: 10, fontWeight: 600, color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    View as another user
                  </div>
                  {KNOWN_USERS.map((u) => (
                    <button key={u.email} onClick={() => handleViewAs(u.email)}
                      style={{
                        display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 10px",
                        background: viewAs === u.email ? "rgba(0,113,227,0.08)" : "transparent",
                        border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                        fontSize: 12, color: viewAs === u.email ? "#0071E3" : "var(--color-text-primary)", fontWeight: viewAs === u.email ? 600 : 400,
                      }}
                      onMouseEnter={(e) => { if (viewAs !== u.email) e.currentTarget.style.background = "rgba(0,0,0,0.035)"; }}
                      onMouseLeave={(e) => { if (viewAs !== u.email) e.currentTarget.style.background = "transparent"; }}
                    >
                      <span style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--color-accent)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                        {u.label[0]}
                      </span>
                      <div>
                        <div style={{ fontWeight: 500 }}>{u.label}</div>
                        <div style={{ fontSize: 10, color: "var(--color-text-tertiary)" }}>{u.email}</div>
                      </div>
                      {viewAs === u.email && <span style={{ marginLeft: "auto", fontSize: 10, color: "#0071E3", fontWeight: 600 }}>Active</span>}
                    </button>
                  ))}
                  {viewAs && (
                    <button onClick={() => handleViewAs(null)}
                      style={{
                        width: "100%", padding: "8px 10px", background: "transparent",
                        border: "none", borderTop: "1px solid var(--color-border)", cursor: "pointer",
                        fontFamily: "inherit", fontSize: 11, color: "var(--color-text-secondary)", textAlign: "left",
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "rgba(0,0,0,0.035)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                    >
                      Back to my view
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          <button
            onClick={handleSignOut}
            disabled={signingOut}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "9px 10px",
              borderRadius: 10,
              width: "100%",
              background: "transparent",
              border: "none",
              color: "var(--color-text-primary)",
              fontWeight: 500,
              fontSize: 13,
              cursor: signingOut ? "wait" : "pointer",
              fontFamily: "inherit",
              textAlign: "left",
              opacity: signingOut ? 0.6 : 1,
            }}
            onMouseEnter={(e) => {
              if (!signingOut) e.currentTarget.style.background = "rgba(0,0,0,0.035)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            {Icon.logout}
            <span>{signingOut ? "Signing out…" : "Sign out"}</span>
          </button>
        </div>
      </aside>
    </>
  );
}

function dashboardSubLinkStyle(active: boolean): React.CSSProperties {
  return {
    display: "block",
    padding: "4px 10px",
    borderRadius: 7,
    fontSize: 11,
    color: active ? "var(--color-accent)" : "var(--color-text-tertiary)",
    background: active ? "rgba(0,113,227,0.08)" : "transparent",
    fontWeight: active ? 600 : 400,
    textDecoration: "none",
    whiteSpace: "nowrap",
  };
}

function SidebarLink({ item, active, onClick, subdued }: { item: NavItem; active: boolean; onClick: () => void; subdued?: boolean }) {
  return (
    <Link
      href={item.href}
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: subdued ? "6px 10px" : "9px 10px",
        borderRadius: 10,
        color: active ? "var(--color-accent)" : (subdued ? "var(--color-text-secondary)" : "var(--color-text-primary)"),
        background: active ? "rgba(0,113,227,0.08)" : "transparent",
        fontWeight: active ? 600 : (subdued ? 400 : 500),
        fontSize: subdued ? 12 : 13,
        textDecoration: "none",
        transition: "background 120ms var(--ease-apple)",
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = "rgba(0,0,0,0.035)";
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = "transparent";
      }}
    >
      {item.icon}
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
    </Link>
  );
}

function CompanyRow({
  name, href, active, expanded, onToggle, onNavigate, icon, chevron,
}: {
  name: string;
  href: string;
  active: boolean;
  expanded: boolean;
  onToggle: () => void;
  onNavigate: () => void;
  icon: React.ReactNode;
  chevron: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex", alignItems: "center",
        borderRadius: 10,
        background: active ? "rgba(0,113,227,0.08)" : "transparent",
        transition: "background 120ms var(--ease-apple)",
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "rgba(0,0,0,0.035)"; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-label={expanded ? "Collapse" : "Expand"}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: 22, height: 28, padding: 0, marginLeft: 2,
          background: "transparent", border: "none", cursor: "pointer",
          color: "var(--color-text-tertiary)",
          transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
          transition: "transform 120ms var(--ease-apple)",
          flexShrink: 0,
        }}
      >
        {chevron}
      </button>
      <Link
        href={href}
        onClick={onNavigate}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          flex: 1, minWidth: 0,
          padding: "6px 10px 6px 4px",
          textDecoration: "none",
          color: active ? "var(--color-accent)" : "var(--color-text-secondary)",
          fontWeight: active ? 600 : 400,
          fontSize: 12,
        }}
      >
        {icon}
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
      </Link>
    </div>
  );
}
