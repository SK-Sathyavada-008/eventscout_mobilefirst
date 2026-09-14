"use client";

import OfflineState from "@/components/OfflineState";

export default function OfflinePage() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <OfflineState onRetry={() => window.location.reload()} />
    </div>
  );
}
