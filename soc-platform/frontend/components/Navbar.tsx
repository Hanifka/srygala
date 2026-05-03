"use client";

import { LayoutGrid, List, BarChart3, RefreshCw, User, LogOut, Terminal } from "lucide-react";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { useTypewriter } from "@/lib/useTypewriter";

type View = "dashboard" | "tickets" | "analytics" | "remote-command";

interface NavbarProps {
  currentView: View;
  onViewChange: (view: View) => void;
  onRefresh: () => void;
}

const navItems: { id: View; label: string; icon: typeof LayoutGrid }[] = [
  { id: "dashboard",      label: "Overview",      icon: LayoutGrid },
  { id: "tickets",        label: "Events",          icon: List },
  { id: "analytics",      label: "Analytics",      icon: BarChart3 },
  { id: "remote-command", label: "Remote command", icon: Terminal },
];

export default function Navbar({ currentView, onViewChange, onRefresh }: NavbarProps) {
  const { creds, logout } = useAuth();
  const { displayed: soc, showCursor } = useTypewriter(["SryGala", "SOC"], {
    delay:            800,
    typeSpeed:        100,
    deleteSpeed:      60,
    pauseAfterType:   2000,
    pauseAfterDelete: 500,
  });

  return (
    <header className="h-[52px] bg-soc-surface border-b border-soc-border flex items-center px-5 justify-between shrink-0">
      <div className="flex items-center gap-3.5">
        <Image src="/logo.png" alt="Logo" width={60} height={60} className="rounded" />
        <div className="flex items-baseline gap-1.5">
          <span className="text-[15px] font-bold text-soc-accent" style={{ width: "72px", display: "inline-block" }}>
            {soc}{showCursor && <span className="animate-pulse">|</span>}
          </span>
        </div>

        <div className="w-px h-5 bg-soc-border mx-2" />

        <nav className="flex gap-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-[13px] font-medium transition-all duration-150",
                  active
                    ? "bg-soc-surface2 text-soc-text border border-soc-border"
                    : "text-soc-muted border border-transparent hover:text-soc-text"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onRefresh}
          className="flex items-center gap-1.5 bg-soc-surface2 text-soc-muted px-2.5 py-1.5 rounded-md text-xs border border-soc-border hover:text-soc-text transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
        <div className="flex items-center gap-1.5 font-mono text-[11px] text-soc-dim">
          <User className="w-3.5 h-3.5" />
          {creds?.username || "analyst"}
        </div>
        <button
          onClick={logout}
          className="text-soc-muted hover:text-soc-text transition-colors p-1.5 rounded-md"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
