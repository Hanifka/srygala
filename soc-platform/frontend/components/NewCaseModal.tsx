"use client";

import { useState, type FormEvent } from "react";
import { X, FolderPlus } from "lucide-react";

interface NewCaseModalProps {
  onClose: () => void;
  onCreate: (data: {
    title: string;
    description: string;
    severity: string;
    assigned: string;
  }) => Promise<void>;
}

export default function NewCaseModal({ onClose, onCreate }: NewCaseModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("medium");
  const [assigned, setAssigned] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await onCreate({ title: title.trim(), description, severity, assigned });
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to create case");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div onClick={onClose} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative w-full max-w-[480px] mx-4 bg-soc-surface border border-soc-border rounded-xl overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="px-5 py-4 border-b border-soc-border bg-soc-surface2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderPlus className="w-4 h-4 text-soc-accent" />
            <span className="text-[14px] font-bold text-soc-text">New Case</span>
          </div>
          <button onClick={onClose} className="text-soc-muted hover:text-soc-text p-1 rounded transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="text-[11px] text-soc-muted uppercase tracking-wider block mb-1">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Brute force attempts on web-server-01"
              autoFocus
              className="w-full"
            />
          </div>

          <div>
            <label className="text-[11px] text-soc-muted uppercase tracking-wider block mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Describe the incident, scope, initial findings…"
              className="w-full resize-y"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-soc-muted uppercase tracking-wider block mb-1">Severity</label>
              <select value={severity} onChange={(e) => setSeverity(e.target.value)} className="w-full">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] text-soc-muted uppercase tracking-wider block mb-1">Assigned to</label>
              <input
                value={assigned}
                onChange={(e) => setAssigned(e.target.value)}
                placeholder="analyst name"
                className="w-full"
              />
            </div>
          </div>

          {error && (
            <div className="text-red-400 text-[12px] bg-red-500/10 border border-red-500/20 rounded-md py-2 px-3">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md text-[13px] font-medium text-soc-muted bg-soc-surface2 border border-soc-border hover:text-soc-text transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !title.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-md text-[13px] font-semibold text-black bg-soc-accent disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              {loading ? "Creating…" : "Create Case"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
