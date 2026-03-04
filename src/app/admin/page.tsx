"use client";

import React from "react";
import AdminLayout from "@/components/layout/admin-layout";

export default function AdminDashboard() {
  return (
    <AdminLayout>
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-zinc-500">Welcome to the Emoji management system.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {[
            { label: "Total Emojis", value: "1,234", change: "+12%" },
            { label: "Total Collections", value: "56", change: "+5%" },
            { label: "Active Users", value: "892", change: "+18%" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border p-6">
              <p className="text-sm font-medium text-zinc-500">{stat.label}</p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-bold">{stat.value}</span>
                <span className="text-xs font-medium text-emerald-600">{stat.change}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
