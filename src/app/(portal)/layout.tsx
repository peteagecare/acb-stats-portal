import { Suspense } from "react";
import Sidebar from "../components/Sidebar";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg-page)" }} className="portal-shell">
      <Suspense fallback={<aside style={{ width: 240, flexShrink: 0 }} />}>
        <Sidebar />
      </Suspense>
      <main style={{ flex: 1, minWidth: 0 }}>{children}</main>
    </div>
  );
}
