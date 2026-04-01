import { NextRequest } from "next/server";
import { GoogleAuth } from "google-auth-library";
import path from "path";

const GA4_PROPERTY_ID = process.env.GA4_PROPERTY_ID;
const GA4_API = "https://analyticsdata.googleapis.com/v1beta";

async function getAccessToken(): Promise<string> {
  let auth: GoogleAuth;

  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    // Env var may have: literal newlines (from .env.local), trailing \n, or escaped \\n
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
      .replace(/\n/g, "\\n")   // literal newlines → escaped for JSON.parse
      .replace(/\\n$/, "");     // strip trailing \n after closing brace
    const credentials = JSON.parse(raw);
    auth = new GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
    });
  } else {
    // Local: read from file
    const keyPath = path.resolve(
      process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || "./ga-service-account.json"
    );
    auth = new GoogleAuth({
      keyFile: keyPath,
      scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
    });
  }

  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  return tokenResponse.token!;
}

export async function GET(request: NextRequest) {
  if (!GA4_PROPERTY_ID) {
    return Response.json({ error: "Missing GA4_PROPERTY_ID" }, { status: 500 });
  }

  const { searchParams } = request.nextUrl;
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!from || !to) {
    return Response.json(
      { error: "Missing required params: from, to" },
      { status: 400 }
    );
  }

  try {
    const token = await getAccessToken();

    const body = {
      dateRanges: [{ startDate: from, endDate: to }],
      metrics: [{ name: "activeUsers" }],
    };

    const res = await fetch(
      `${GA4_API}/properties/${GA4_PROPERTY_ID}:runReport`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      return Response.json({ error: err }, { status: res.status });
    }

    const data = await res.json();
    const activeUsers =
      data.rows?.[0]?.metricValues?.[0]?.value ?? "0";

    return Response.json({ activeUsers: parseInt(activeUsers, 10) });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "GA4 error" },
      { status: 500 }
    );
  }
}
