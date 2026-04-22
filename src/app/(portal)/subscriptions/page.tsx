"use client";

import { useEffect, useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

interface Subscription {
  id: string;
  name: string;
  cost: number;
  currency: "GBP" | "USD" | "EUR";
  frequency: "monthly" | "annual";
  category: string;
  notes: string;
  startDate?: string;   // YYYY-MM-DD
  endDate?: string;     // YYYY-MM-DD (blank = still active)
  paymentDay?: number;  // 1-28
  replaceableByAI?: boolean;
}

const EMPTY: Subscription = { id: "", name: "", cost: 0, currency: "GBP", frequency: "monthly", category: "", notes: "", startDate: "", endDate: "", paymentDay: 1, replaceableByAI: false };

const CATEGORIES = ["PPC", "SEO", "Content", "General", "Website"];

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/** Format in original currency */
function fmtOriginal(n: number, currency: "GBP" | "USD" | "EUR") {
  return n.toLocaleString("en-GB", { style: "currency", currency, minimumFractionDigits: 2 });
}

/** Format in GBP */
function gbp(n: number) {
  return n.toLocaleString("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 2 });
}

/** Convert to GBP */
function toGbp(n: number, currency: "GBP" | "USD" | "EUR", usdRate: number, eurRate: number) {
  if (currency === "USD") return n * usdRate;
  if (currency === "EUR") return n * eurRate;
  return n;
}

function monthlyRaw(s: Subscription) {
  return s.frequency === "annual" ? s.cost / 12 : s.cost;
}

function annualRaw(s: Subscription) {
  return s.frequency === "monthly" ? s.cost * 12 : s.cost;
}

export default function SubscriptionsPage() {
  const [items, setItems] = useState<Subscription[]>([]);
  const [usdToGbp, setUsdToGbp] = useState(0.79);
  const [eurToGbp, setEurToGbp] = useState(0.86);
  const [claudeAnnualGbp, setClaudeAnnualGbp] = useState(240);
  const [claudePriceDraft, setClaudePriceDraft] = useState("240");
  const [rateDate, setRateDate] = useState<string | null>(null);
  const [rateLive, setRateLive] = useState(true);
  const [spreadView, setSpreadView] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Subscription | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [sortCol, setSortCol] = useState<"name" | "cost" | "frequency" | "category" | "monthly">("name");
  const [sortAsc, setSortAsc] = useState(true);

  useEffect(() => {
    // Load subscriptions and live rate in parallel
    const subsP = fetch("/api/subscriptions").then((r) => (r.ok ? r.json() : null));
    const rateP = fetch("/api/exchange-rate").then((r) => (r.ok ? r.json() : null));

    Promise.all([subsP, rateP])
      .then(([subsData, rateData]) => {
        setItems(subsData?.items ?? []);
        const savedUsd = subsData?.usdToGbp ?? 0.79;
        const savedEur = subsData?.eurToGbp ?? 0.86;
        const cp = subsData?.claudeAnnualGbp ?? 240;
        setClaudeAnnualGbp(cp);
        setClaudePriceDraft(String(cp));

        if (rateData?.usdToGbp) {
          setUsdToGbp(rateData.usdToGbp);
          if (rateData.eurToGbp) setEurToGbp(rateData.eurToGbp);
          setRateDate(rateData.updated);
          setRateLive(true);
          // Save live rates
          const usdChanged = Math.abs(rateData.usdToGbp - savedUsd) > 0.001;
          const eurChanged = rateData.eurToGbp && Math.abs(rateData.eurToGbp - savedEur) > 0.001;
          if (usdChanged || eurChanged) {
            fetch("/api/subscriptions", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ items: subsData?.items ?? [], usdToGbp: rateData.usdToGbp, eurToGbp: rateData.eurToGbp ?? savedEur }),
            }).catch(() => {});
          }
        } else {
          setUsdToGbp(savedUsd);
          setEurToGbp(savedEur);
          setRateLive(false);
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  async function persist(updated: Subscription[]) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: updated, usdToGbp, eurToGbp, claudeAnnualGbp }),
      });
      if (!res.ok) throw new Error("Save failed");
      setItems(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function handleSave(sub: Subscription) {
    let updated: Subscription[];
    if (sub.id) {
      updated = items.map((s) => (s.id === sub.id ? sub : s));
    } else {
      updated = [...items, { ...sub, id: uid() }];
    }
    setShowForm(false);
    setEditing(null);
    persist(updated);
  }

  function handleDelete(id: string) {
    persist(items.filter((s) => s.id !== id));
  }

  function handleSort(col: typeof sortCol) {
    if (sortCol === col) {
      setSortAsc(!sortAsc);
    } else {
      setSortCol(col);
      setSortAsc(true);
    }
  }

  // Monthly/annual in GBP
  function monthlyGbp(s: Subscription) { return toGbp(monthlyRaw(s), s.currency, usdToGbp, eurToGbp); }
  function annualGbp(s: Subscription) { return toGbp(annualRaw(s), s.currency, usdToGbp, eurToGbp); }

  const sorted = [...items].sort((a, b) => {
    let cmp = 0;
    switch (sortCol) {
      case "name": cmp = a.name.localeCompare(b.name); break;
      case "cost": cmp = toGbp(a.cost, a.currency, usdToGbp, eurToGbp) - toGbp(b.cost, b.currency, usdToGbp, eurToGbp); break;
      case "frequency": cmp = a.frequency.localeCompare(b.frequency); break;
      case "category": cmp = a.category.localeCompare(b.category); break;
      case "monthly": cmp = monthlyGbp(a) - monthlyGbp(b); break;
    }
    return sortAsc ? cmp : -cmp;
  });

  const totalMonthly = items.reduce((s, i) => s + monthlyGbp(i), 0);
  const totalAnnual = items.reduce((s, i) => s + annualGbp(i), 0);
  const monthlyCount = items.filter((i) => i.frequency === "monthly").length;
  const annualCount = items.filter((i) => i.frequency === "annual").length;
  const usdCount = items.filter((i) => i.currency === "USD").length;
  const eurCount = items.filter((i) => i.currency === "EUR").length;
  const foreignCount = usdCount + eurCount;

  // Category breakdown in GBP
  const byCat: Record<string, number> = {};
  items.forEach((i) => {
    const cat = i.category || "Other";
    byCat[cat] = (byCat[cat] || 0) + monthlyGbp(i);
  });
  const catEntries = Object.entries(byCat).sort((a, b) => b[1] - a[1]);

  const arrow = (col: typeof sortCol) => sortCol === col ? (sortAsc ? " \u25B2" : " \u25BC") : "";

  // Monthly cost history chart data
  const chartData = useMemo(() => {
    // Find earliest start date across all subs (default 12 months ago)
    const now = new Date();
    let earliest = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    items.forEach((s) => {
      if (s.startDate) {
        const d = new Date(s.startDate + "T00:00:00");
        if (d < earliest) earliest = new Date(d.getFullYear(), d.getMonth(), 1);
      }
    });
    const months: { key: string; label: string; total: number;[cat: string]: string | number }[] = [];
    const d = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 1);
    while (d <= end) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
      const entry: { key: string; label: string; total: number;[cat: string]: string | number } = { key, label, total: 0 };
      items.forEach((s) => {
        const start = s.startDate ? new Date(s.startDate + "T00:00:00") : null;
        const finish = s.endDate ? new Date(s.endDate + "T00:00:00") : null;
        // Check if this sub was active in this month
        const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
        const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        if (start && start > monthEnd) return; // hasn't started yet
        if (finish && finish < monthStart) return; // already ended
        if (!start) return; // no start date = can't chart it

        let monthlyCost: number;
        if (s.frequency === "annual") {
          if (spreadView) {
            // Spread: divide annual cost evenly across 12 months
            monthlyCost = toGbp(s.cost / 12, s.currency, usdToGbp, eurToGbp);
          } else {
            // Actual: only show in the renewal month (month the sub started)
            if (start && d.getMonth() === start.getMonth()) {
              monthlyCost = toGbp(s.cost, s.currency, usdToGbp, eurToGbp);
            } else {
              return;
            }
          }
        } else {
          monthlyCost = toGbp(s.cost, s.currency, usdToGbp, eurToGbp);
        }

        const cat = s.category || "Other";
        entry[cat] = ((entry[cat] as number) || 0) + monthlyCost;
        entry.total += monthlyCost;
      });
      months.push(entry);
      d.setMonth(d.getMonth() + 1);
    }
    return months;
  }, [items, usdToGbp, eurToGbp, spreadView]);

  const chartCategories = useMemo(() => {
    const cats = new Set<string>();
    items.forEach((s) => cats.add(s.category || "Other"));
    return [...cats].sort();
  }, [items]);

  const CAT_COLORS: Record<string, string> = { PPC: "#E8833A", SEO: "#30A46C", Content: "#D93D42", General: "#0071E3", Website: "#8E4EC6", Other: "#86868B" };

  return (
    <div style={{ padding: "28px 28px 48px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 22 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--color-text-primary)" }}>
            Subscriptions
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--color-text-secondary)" }}>
            Track all business subscriptions. Costs shown in original currency, totals settled in GBP.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {saved && (
            <span style={{ fontSize: 12, color: "#107A3E", background: "#E3F5EA", padding: "6px 10px", borderRadius: 999, fontWeight: 600 }}>
              Saved
            </span>
          )}
          {error && (
            <span style={{ fontSize: 12, color: "#9E1A1E", background: "#FCE6E7", padding: "6px 10px", borderRadius: 999, fontWeight: 600 }}>
              {error}
            </span>
          )}
          <button
            onClick={() => { setEditing(null); setShowForm(true); }}
            disabled={!loaded || saving}
            style={{
              background: "var(--color-accent)",
              color: "white",
              border: "none",
              padding: "10px 18px",
              borderRadius: "var(--radius-button)",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            + Add subscription
          </button>
        </div>
      </div>

      {/* Exchange rates — live */}
      {foreignCount > 0 && (
        <div style={{
          background: "var(--bg-card)", borderRadius: "var(--radius-card)", boxShadow: "var(--shadow-card)",
          padding: "12px 18px", marginBottom: 12, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
        }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)" }}>Exchange rates:</span>
          {usdCount > 0 && (
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)" }}>
              $1 = {"\u00A3"}{usdToGbp.toFixed(4)}
            </span>
          )}
          {eurCount > 0 && (
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)" }}>
              {"\u20AC"}1 = {"\u00A3"}{eurToGbp.toFixed(4)}
            </span>
          )}
          {rateLive ? (
            <span style={{ fontSize: 11, color: "#107A3E", background: "#E3F5EA", padding: "3px 8px", borderRadius: 999, fontWeight: 600 }}>
              Live{rateDate ? ` (${rateDate})` : ""}
            </span>
          ) : (
            <span style={{ fontSize: 11, color: "#B36B00", background: "#FFF3E0", padding: "3px 8px", borderRadius: 999, fontWeight: 600 }}>
              Cached (API unavailable)
            </span>
          )}
          <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>
            {usdCount > 0 && `${usdCount} in USD`}{usdCount > 0 && eurCount > 0 && ", "}{eurCount > 0 && `${eurCount} in EUR`}. Rates update automatically.
          </span>
        </div>
      )}

      {/* Summary cards — all in GBP */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, marginBottom: 20 }}>
        <SummaryCard label="Total monthly (GBP)" value={gbp(totalMonthly)} sub={`${items.length} subscription${items.length !== 1 ? "s" : ""}`} accent="#0071E3" />
        <SummaryCard label="Total annual (GBP)" value={gbp(totalAnnual)} sub={`${monthlyCount} monthly, ${annualCount} annual`} accent="#8E4EC6" />
        <SummaryCard label="Monthly subs (GBP)" value={gbp(items.filter((i) => i.frequency === "monthly").reduce((s, i) => s + toGbp(i.cost, i.currency, usdToGbp, eurToGbp), 0))} sub={`${monthlyCount} subscription${monthlyCount !== 1 ? "s" : ""}`} accent="#30A46C" />
        <SummaryCard label="Annual subs (GBP)" value={gbp(items.filter((i) => i.frequency === "annual").reduce((s, i) => s + toGbp(i.cost, i.currency, usdToGbp, eurToGbp), 0))} sub={`${annualCount} subscription${annualCount !== 1 ? "s" : ""} (total annual cost)`} accent="#E8833A" />
      </div>

      {/* Category breakdown in GBP */}
      {catEntries.length > 0 && (
        <div style={{ background: "var(--bg-card)", borderRadius: "var(--radius-card)", boxShadow: "var(--shadow-card)", padding: "16px 20px", marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: 10 }}>Monthly cost by category (GBP)</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
            {catEntries.map(([cat, val]) => (
              <div key={cat} style={{ fontSize: 13 }}>
                <span style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>{cat}:</span>{" "}
                <span style={{ color: "var(--color-text-secondary)" }}>{gbp(val)}/mo</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Claude AI savings + settings */}
      {items.some((s) => s.replaceableByAI) && (() => {
        const replaceable = items.filter((s) => s.replaceableByAI && !s.endDate);
        const savingsAnnual = replaceable.reduce((s, i) => s + annualGbp(i), 0);
        const netSaving = savingsAnnual - claudeAnnualGbp;
        return (
          <div style={{ background: "#FFFBEB", borderRadius: "var(--radius-card)", boxShadow: "var(--shadow-card)", padding: "16px 20px", marginBottom: 20, border: "1px solid #FDE68A" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#92400E", marginBottom: 4 }}>Replaceable by Claude AI</div>
                <div style={{ fontSize: 13, color: "#1D1D1F" }}>
                  <strong>{replaceable.length}</strong> active subscription{replaceable.length !== 1 ? "s" : ""} worth <strong>{gbp(savingsAnnual)}/yr</strong> could be replaced.
                  {" "}Claude at <strong>{gbp(claudeAnnualGbp)}/yr</strong> = net saving of <strong style={{ color: netSaving > 0 ? "#107A3E" : "#9E1A1E" }}>{gbp(netSaving)}/yr</strong>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 11, color: "#92400E" }}>Claude £</span>
                <input type="number" min="0" step="1" value={claudePriceDraft}
                  onChange={(e) => setClaudePriceDraft(e.target.value)}
                  onBlur={() => {
                    const v = parseFloat(claudePriceDraft);
                    if (Number.isFinite(v) && v >= 0) {
                      setClaudeAnnualGbp(v);
                      persist(items);
                    } else {
                      setClaudePriceDraft(String(claudeAnnualGbp));
                    }
                  }}
                  onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                  style={{ width: 60, border: "1px solid #FDE68A", borderRadius: 6, padding: "4px 8px", fontSize: 12, fontWeight: 600, textAlign: "center", background: "white", outline: "none", fontFamily: "inherit" }}
                />
                <span style={{ fontSize: 11, color: "#92400E" }}>/yr</span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* View toggle */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button onClick={() => setSpreadView(false)}
          style={{ fontSize: 11, fontWeight: spreadView ? 400 : 600, color: spreadView ? "#86868B" : "white", background: spreadView ? "rgba(0,0,0,0.04)" : "#0071E3", border: "none", borderRadius: 6, padding: "5px 12px", cursor: "pointer" }}>
          Actual costs
        </button>
        <button onClick={() => setSpreadView(true)}
          style={{ fontSize: 11, fontWeight: spreadView ? 600 : 400, color: spreadView ? "white" : "#86868B", background: spreadView ? "#0071E3" : "rgba(0,0,0,0.04)", border: "none", borderRadius: 6, padding: "5px 12px", cursor: "pointer" }}>
          Spread annual costs (cashflow view)
        </button>
      </div>

      {/* Monthly spend chart */}
      {chartData.length > 0 && items.some((s) => s.startDate) && (
        <div style={{ background: "var(--bg-card)", borderRadius: "var(--radius-card)", boxShadow: "var(--shadow-card)", padding: "20px 20px 12px", marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: 12 }}>Monthly spend over time (GBP)</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E5EA" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#86868B" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#86868B" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `£${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : Math.round(v)}`} />
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={((value: any, name: any) => [gbp(Number(value)), String(name)]) as any}
                labelFormatter={((label: unknown) => String(label)) as any}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E5E5EA" }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {chartCategories.map((cat) => (
                <Bar key={cat} dataKey={cat} stackId="a" fill={CAT_COLORS[cat] || "#86868B"} radius={[2, 2, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Modal form */}
      {showForm && (
        <SubForm
          initial={editing ?? EMPTY}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditing(null); }}
        />
      )}

      {/* Table */}
      {!loaded ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--color-text-tertiary)", fontSize: 13 }}>Loading...</div>
      ) : items.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "var(--color-text-tertiary)", fontSize: 13 }}>
          No subscriptions yet. Click &quot;+ Add subscription&quot; to get started.
        </div>
      ) : (
        <div style={{ background: "var(--bg-card)", borderRadius: "var(--radius-card)", boxShadow: "var(--shadow-card)", overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                  <Th onClick={() => handleSort("name")}>Name{arrow("name")}</Th>
                  <Th onClick={() => handleSort("category")}>Category{arrow("category")}</Th>
                  <Th onClick={() => handleSort("cost")} align="right">Cost{arrow("cost")}</Th>
                  <Th onClick={() => handleSort("frequency")}>Billing{arrow("frequency")}</Th>
                  <Th>Status</Th>
                  <Th onClick={() => handleSort("monthly")} align="right">{spreadView ? "Monthly equiv." : "Per month"} (GBP){arrow("monthly")}</Th>
                  <Th align="right">{spreadView ? "Annual equiv." : "Per year"} (GBP)</Th>
                  <Th>AI?</Th>
                  <th style={{ padding: "10px 16px", width: 90 }} />
                </tr>
              </thead>
              <tbody>
                {sorted.map((s) => (
                  <tr key={s.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                    <td style={{ padding: "10px 16px", fontWeight: 500, color: "var(--color-text-primary)" }}>
                      {s.name}
                      {s.notes && <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 2 }}>{s.notes}</div>}
                    </td>
                    <td style={{ padding: "10px 16px", color: "var(--color-text-secondary)" }}>{s.category || "\u2014"}</td>
                    <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 600, color: "var(--color-text-primary)" }}>
                      {fmtOriginal(s.cost, s.currency)}
                      {s.currency !== "GBP" && (
                        <div style={{ fontSize: 10, color: "var(--color-text-tertiary)", fontWeight: 400 }}>
                          {gbp(toGbp(s.cost, s.currency, usdToGbp, eurToGbp))}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "10px 16px" }}>
                      <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{
                          display: "inline-block",
                          padding: "3px 8px",
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 600,
                          background: s.frequency === "monthly" ? "#E3F5EA" : "#EDE8F5",
                          color: s.frequency === "monthly" ? "#107A3E" : "#6B3FA0",
                        }}>
                          {s.frequency === "monthly" ? "Monthly" : "Annual"}
                        </span>
                        {s.currency !== "GBP" && (
                          <span style={{
                            display: "inline-block",
                            padding: "3px 6px",
                            borderRadius: 999,
                            fontSize: 10,
                            fontWeight: 600,
                            background: s.currency === "EUR" ? "#E8EAF6" : "#FFF3E0",
                            color: s.currency === "EUR" ? "#3949AB" : "#B36B00",
                          }}>
                            {s.currency}
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: "10px 16px" }}>
                      {s.startDate ? (
                        <div>
                          {s.endDate ? (
                            <span style={{ fontSize: 10, fontWeight: 600, color: "#9E1A1E", background: "#FCE6E7", padding: "2px 7px", borderRadius: 999 }}>Cancelled</span>
                          ) : (
                            <span style={{ fontSize: 10, fontWeight: 600, color: "#107A3E", background: "#E3F5EA", padding: "2px 7px", borderRadius: 999 }}>Active</span>
                          )}
                          <div style={{ fontSize: 10, color: "var(--color-text-tertiary)", marginTop: 3 }}>
                            {new Date(s.startDate + "T00:00:00").toLocaleDateString("en-GB", { month: "short", year: "numeric" })}
                            {s.endDate && ` — ${new Date(s.endDate + "T00:00:00").toLocaleDateString("en-GB", { month: "short", year: "numeric" })}`}
                          </div>
                          {s.paymentDay && <div style={{ fontSize: 10, color: "var(--color-text-tertiary)" }}>Pays: {s.paymentDay}{s.paymentDay === 1 ? "st" : s.paymentDay === 2 ? "nd" : s.paymentDay === 3 ? "rd" : "th"}</div>}
                        </div>
                      ) : (
                        <span style={{ fontSize: 10, color: "var(--color-text-tertiary)" }}>{"\u2014"}</span>
                      )}
                    </td>
                    <td style={{ padding: "10px 16px", textAlign: "right", color: "var(--color-text-secondary)" }}>
                      {spreadView ? (
                        <>
                          {gbp(monthlyGbp(s))}
                          {s.frequency === "annual" && (
                            <div style={{ fontSize: 10, color: "#8E4EC6", fontStyle: "italic" }}>spread from {gbp(toGbp(s.cost, s.currency, usdToGbp, eurToGbp))}/yr</div>
                          )}
                        </>
                      ) : (
                        s.frequency === "monthly" ? gbp(monthlyGbp(s)) : <span style={{ color: "var(--color-text-tertiary)" }}>{"\u2014"}</span>
                      )}
                    </td>
                    <td style={{ padding: "10px 16px", textAlign: "right", color: "var(--color-text-secondary)" }}>
                      {spreadView ? (
                        <>
                          {gbp(annualGbp(s))}
                          {s.frequency === "monthly" && (
                            <div style={{ fontSize: 10, color: "#0071E3", fontStyle: "italic" }}>{gbp(toGbp(s.cost, s.currency, usdToGbp, eurToGbp))}/mo x 12</div>
                          )}
                        </>
                      ) : (
                        s.frequency === "annual" ? gbp(annualGbp(s)) : <span style={{ color: "var(--color-text-tertiary)" }}>{"\u2014"}</span>
                      )}
                    </td>
                    <td style={{ padding: "10px 16px", textAlign: "center" }}>
                      {s.replaceableByAI ? (
                        <span style={{ fontSize: 10, fontWeight: 600, color: "#92400E", background: "#FFFBEB", padding: "2px 7px", borderRadius: 999, border: "1px solid #FDE68A" }}>AI</span>
                      ) : (
                        <span style={{ color: "var(--color-text-tertiary)", fontSize: 11 }}>{"\u2014"}</span>
                      )}
                    </td>
                    <td style={{ padding: "10px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
                      <button
                        onClick={() => { setEditing(s); setShowForm(true); }}
                        style={{ background: "none", border: "none", color: "var(--color-accent)", cursor: "pointer", fontSize: 12, fontWeight: 600, marginRight: 8 }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(s.id)}
                        style={{ background: "none", border: "none", color: "#D93D42", cursor: "pointer", fontSize: 12, fontWeight: 600 }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: "rgba(0,0,0,0.02)" }}>
                  <td colSpan={2} style={{ padding: "10px 16px", fontWeight: 700, fontSize: 13, color: "var(--color-text-primary)" }}>Totals (GBP)</td>
                  <td style={{ padding: "10px 16px" }} />
                  <td style={{ padding: "10px 16px" }} />
                  <td style={{ padding: "10px 16px" }} />
                  <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 700, color: "var(--color-text-primary)" }}>
                    {spreadView
                      ? gbp(totalMonthly)
                      : gbp(items.filter((i) => i.frequency === "monthly").reduce((s, i) => s + monthlyGbp(i), 0))
                    }
                  </td>
                  <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 700, color: "var(--color-text-primary)" }}>
                    {spreadView
                      ? gbp(totalAnnual)
                      : gbp(items.filter((i) => i.frequency === "annual").reduce((s, i) => s + annualGbp(i), 0))
                    }
                  </td>
                  <td style={{ padding: "10px 16px" }} />
                  <td style={{ padding: "10px 16px" }} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, sub, accent }: { label: string; value: string; sub: string; accent: string }) {
  return (
    <div style={{ background: "var(--bg-card)", borderRadius: "var(--radius-card)", boxShadow: "var(--shadow-card)", padding: "16px 18px" }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: accent, marginTop: 4 }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 2 }}>{sub}</div>
    </div>
  );
}

function Th({ children, onClick, align }: { children: React.ReactNode; onClick?: () => void; align?: "right" }) {
  return (
    <th
      onClick={onClick}
      style={{
        padding: "10px 16px",
        textAlign: align ?? "left",
        fontWeight: 600,
        fontSize: 11,
        color: "var(--color-text-tertiary)",
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        cursor: onClick ? "pointer" : "default",
        userSelect: "none",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function SubForm({ initial, onSave, onCancel }: { initial: Subscription; onSave: (s: Subscription) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState<Subscription>(initial);
  const isNew = !initial.id;

  function set<K extends keyof Subscription>(key: K, val: Subscription[K]) {
    setDraft((d) => ({ ...d, [key]: val }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.name.trim()) return;
    onSave({ ...draft, name: draft.name.trim(), notes: draft.notes.trim(), category: draft.category.trim() });
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-button)",
    padding: "8px 12px",
    fontSize: 14,
    color: "var(--color-text-primary)",
    background: "white",
    outline: "none",
    fontFamily: "inherit",
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
    }} onClick={onCancel}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "white",
          borderRadius: 16,
          padding: 28,
          width: "100%",
          maxWidth: 440,
          boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
        }}
      >
        <h2 style={{ margin: "0 0 20px", fontSize: 17, fontWeight: 600, color: "var(--color-text-primary)" }}>
          {isNew ? "Add subscription" : "Edit subscription"}
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>Name *</span>
            <input style={inputStyle} value={draft.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. HubSpot CRM" autoFocus />
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>Cost</span>
              <input style={inputStyle} type="number" min="0" step="0.01" value={draft.cost || ""} onChange={(e) => set("cost", parseFloat(e.target.value) || 0)} placeholder="0.00" />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>Currency</span>
              <select style={{ ...inputStyle, cursor: "pointer" }} value={draft.currency} onChange={(e) => set("currency", e.target.value as "GBP" | "USD" | "EUR")}>
                <option value="GBP">GBP ({"\u00A3"})</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR ({"\u20AC"})</option>
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>Billing</span>
              <select style={{ ...inputStyle, cursor: "pointer" }} value={draft.frequency} onChange={(e) => set("frequency", e.target.value as "monthly" | "annual")}>
                <option value="monthly">Monthly</option>
                <option value="annual">Annual</option>
              </select>
            </label>
          </div>

          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>Category</span>
            <select style={{ ...inputStyle, cursor: "pointer" }} value={draft.category} onChange={(e) => set("category", e.target.value)}>
              <option value="">Select...</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>Start date</span>
              <input style={inputStyle} type="date" value={draft.startDate || ""} onChange={(e) => set("startDate", e.target.value)} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>End date</span>
              <input style={inputStyle} type="date" value={draft.endDate || ""} onChange={(e) => set("endDate", e.target.value)} />
              <span style={{ fontSize: 10, color: "var(--color-text-tertiary)" }}>Blank = active</span>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>Payment day</span>
              <input style={inputStyle} type="number" min="1" max="28" value={draft.paymentDay || ""} onChange={(e) => set("paymentDay", parseInt(e.target.value) || 1)} placeholder="1" />
            </label>
          </div>

          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>Notes</span>
            <input style={inputStyle} value={draft.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Optional notes" />
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={draft.replaceableByAI ?? false} onChange={(e) => set("replaceableByAI", e.target.checked)}
              style={{ width: 16, height: 16, accentColor: "#0071E3", cursor: "pointer" }} />
            <span style={{ fontSize: 12, fontWeight: 600 }}>Could be replaced by Claude AI</span>
          </label>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22 }}>
          <button type="button" onClick={onCancel} style={{ padding: "10px 18px", borderRadius: "var(--radius-button)", border: "1px solid var(--color-border)", background: "white", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "var(--color-text-primary)" }}>
            Cancel
          </button>
          <button type="submit" style={{ padding: "10px 18px", borderRadius: "var(--radius-button)", border: "none", background: "var(--color-accent)", color: "white", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            {isNew ? "Add" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
