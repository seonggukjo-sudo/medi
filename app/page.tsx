"use client";

import dynamic from "next/dynamic";

const Dashboard = dynamic(() => import("./dashboard-client"), {
  ssr: false,
  loading: () => (
    <main className="dashboard-loading" aria-live="polite">
      <div className="dashboard-loading-card">
        <strong>메디인사이트</strong>
        <span>대시보드를 불러오는 중입니다.</span>
      </div>
    </main>
  ),
});

export default function Home() {
  return <Dashboard />;
}
