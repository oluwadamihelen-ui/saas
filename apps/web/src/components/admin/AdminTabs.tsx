"use client";

import { useState, type ReactNode } from "react";

export interface AdminTab {
  key: string;
  label: string;
  badge?: number;
  content: ReactNode;
}

export function AdminTabs({ tabs }: { tabs: AdminTab[] }) {
  const [active, setActive] = useState(tabs[0]!.key);

  return (
    <div className="mt-6">
      <div className="flex flex-wrap gap-1 border-b border-cinerra-border">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActive(tab.key)}
            className={`relative flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition ${
              active === tab.key ? "text-cinerra-text" : "text-cinerra-muted hover:text-cinerra-text"
            }`}
          >
            {tab.label}
            {!!tab.badge && (
              <span className="rounded-full bg-red-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-red-300">{tab.badge}</span>
            )}
            {active === tab.key && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-cinerra-accent" />}
          </button>
        ))}
      </div>
      <div className="mt-6">{tabs.find((tab) => tab.key === active)?.content}</div>
    </div>
  );
}
