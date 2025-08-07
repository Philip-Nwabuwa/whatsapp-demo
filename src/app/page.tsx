"use client";

import WhatsAppDashboard from "@/components/WhatsAppDashboard";
import AuthGuard from "@/components/AuthGuard";

export default function Home() {
  return (
    <AuthGuard>
      <WhatsAppDashboard />
    </AuthGuard>
  );
}
