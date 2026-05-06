import { Suspense } from "react";
import Sidebar from "../components/Sidebar";
import { TimerProvider } from "../components/TimerProvider";
import { FloatingTimer } from "../components/FloatingTimer";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <TimerProvider>
      <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg-page)" }} className="portal-shell">
        <Suspense fallback={<aside style={{ width: 240, flexShrink: 0 }} />}>
          <Sidebar />
        </Suspense>
        <main style={{ flex: 1, minWidth: 0 }}>{children}</main>
      </div>
      <FloatingTimer />
    </TimerProvider>
  );
}
