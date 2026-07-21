"use client";

import { useEffect, useState, type ComponentType } from "react";

export default function Home() {
  const [Dashboard, setDashboard] = useState<ComponentType | null>(null);

  useEffect(() => {
    let active = true;

    import("./dashboard-client").then(({ default: DashboardPage }) => {
      if (active) setDashboard(() => DashboardPage);
    });

    return () => {
      active = false;
    };
  }, []);

  if (Dashboard) return <Dashboard />;

  return (
    <main className="dashboard-loading" aria-live="polite">
      <div className="dashboard-loading-card">
        <strong>메디인사이트</strong>
        <span>대시보드를 불러오는 중입니다.</span>
      </div>
    </main>
  );
}
