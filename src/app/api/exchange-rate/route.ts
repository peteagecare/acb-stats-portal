export async function GET() {
  try {
    const res = await fetch("https://api.frankfurter.dev/v1/latest?base=USD&symbols=GBP,EUR", {
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error("Exchange rate API error");
    const data = await res.json();
    const usdToGbp = data?.rates?.GBP;
    // EUR→GBP: derive from USD rates (GBP/USD ÷ EUR/USD)
    const eurToUsd = data?.rates?.EUR;
    const eurToGbp = typeof usdToGbp === "number" && typeof eurToUsd === "number" && eurToUsd > 0
      ? usdToGbp / eurToUsd
      : null;
    if (typeof usdToGbp !== "number") throw new Error("Invalid rate data");
    return Response.json({ usdToGbp, eurToGbp, updated: data.date });
  } catch {
    return Response.json({ usdToGbp: null, eurToGbp: null, updated: null, error: "Could not fetch live rate" }, { status: 502 });
  }
}
