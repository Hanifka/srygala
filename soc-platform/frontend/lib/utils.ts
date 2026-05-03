import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function levelColor(level?: number): string {
  if (!level) return "#06d6a0";
  if (level >= 12) return "#ef4444";
  if (level >= 7) return "#f59e0b";
  if (level >= 4) return "#eab308";
  return "#06d6a0";
}

export function levelLabel(level?: number): string {
  if (!level) return "Low";
  if (level >= 12) return "Critical";
  if (level >= 10) return "High";
  if (level >= 7) return "Medium";
  return "Low";
}

export function statusColor(status?: string): string {
  switch (status) {
    case "open":          return "#ef4444";
    case "investigating": return "#f59e0b";
    case "closed":        return "#22c55e";
    default:              return "#7b8ba3";
  }
}

export function formatTimestamp(iso?: string): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return (
      d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
      " " +
      d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
    );
  } catch { return "—"; }
}

export function flattenAgent(agent?: Record<string, unknown> | string): string {
  if (!agent) return "—";
  if (typeof agent === "string") return agent;
  return (agent.name as string) || (agent.id as string) || "—";
}

export function flattenRule(rule?: Record<string, unknown> | string): string {
  if (!rule) return "—";
  if (typeof rule === "string") return rule;
  return (rule.description as string) || "—";
}
