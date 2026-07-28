"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ScrollText,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Ban,
  ChevronDown,
  Search,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface AuditLogItem {
  id: string;
  actorId: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  category: string;
  action: string;
  targetId: string | null;
  targetType: string | null;
  description: string;
  outcome: string;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

interface AuditResponse {
  items: AuditLogItem[];
  nextCursor: string | null;
  total: number;
}

function outcomeIcon(outcome: string) {
  switch (outcome) {
    case "success":
      return <CheckCircle2 className="h-3.5 w-3.5 text-mint" />;
    case "failure":
      return <XCircle className="h-3.5 w-3.5 text-saffron" />;
    case "denied":
      return <Ban className="h-3.5 w-3.5 text-rose" />;
    default:
      return <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}

function outcomeBadgeClass(outcome: string) {
  switch (outcome) {
    case "success":
      return "bg-mint/15 text-mint border-mint/30";
    case "failure":
      return "bg-saffron/15 text-saffron border-saffron/30";
    case "denied":
      return "bg-rose/15 text-rose border-rose/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function roleBadgeClass(role: string | null) {
  if (!role) return "bg-muted text-muted-foreground";
  const map: Record<string, string> = {
    ADMIN: "bg-rose/15 text-rose",
    DRIVER: "bg-mint/15 text-mint",
    MERCHANT: "bg-lavender/15 text-lavender",
    CUSTOMER: "bg-saffron/15 text-saffron",
  };
  return map[role] ?? "bg-muted text-muted-foreground";
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function AuditLogViewer() {
  const [data, setData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterOutcome, setFilterOutcome] = useState<string>("");
  const [filterEmail, setFilterEmail] = useState<string>("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchLogs = useCallback(async (cursor?: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("limit", "20");
      if (cursor) params.set("cursor", cursor);
      if (filterCategory) params.set("category", filterCategory);
      if (filterOutcome) params.set("outcome", filterOutcome);
      if (filterEmail) params.set("email", filterEmail);

      const res = await fetch(`/api/audit/logs?${params.toString()}`, { cache: "no-store" });
      if (res.status === 403) {
        setError("Forbidden — hanya admin yang dapat melihat audit log.");
        return;
      }
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error || "Gagal memuat audit log.");
        return;
      }
      if (cursor && data) {
        // Append (load more)
        setData({
          ...json,
          items: [...data.items, ...json.items],
        });
      } else {
        setData(json);
      }
    } catch {
      setError("Koneksi bermasalah.");
    } finally {
      setLoading(false);
    }
  }, [filterCategory, filterOutcome, filterEmail, data]);

  useEffect(() => {
    fetchLogs();
  }, [filterCategory, filterOutcome, filterEmail]);

  function resetFilters() {
    setFilterCategory("");
    setFilterOutcome("");
    setFilterEmail("");
  }

  return (
    <section className="accent-rose rounded-2xl border border-border bg-card p-5 sm:p-6">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose text-rose-foreground">
            <ScrollText className="h-4.5 w-4.5" strokeWidth={2.2} />
          </span>
          <div>
            <h3 className="font-display text-lg font-700 text-foreground">Audit Log</h3>
            <p className="text-xs text-muted-foreground">
              Jejak forensik semua aksi sensitif · {data?.total ?? 0} total events
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchLogs()}
          disabled={loading}
          className="h-8"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          Refresh
        </Button>
      </header>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="email"
            placeholder="Filter email…"
            value={filterEmail}
            onChange={(e) => setFilterEmail(e.target.value)}
            className="h-8 w-44 pl-8 text-xs"
          />
        </div>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="h-8 rounded-lg border border-border bg-card px-2 text-xs"
        >
          <option value="">Semua kategori</option>
          <option value="auth">auth</option>
          <option value="admin">admin</option>
          <option value="merchant">merchant</option>
          <option value="driver">driver</option>
          <option value="order">order</option>
        </select>
        <select
          value={filterOutcome}
          onChange={(e) => setFilterOutcome(e.target.value)}
          className="h-8 rounded-lg border border-border bg-card px-2 text-xs"
        >
          <option value="">Semua outcome</option>
          <option value="success">success</option>
          <option value="failure">failure</option>
          <option value="denied">denied</option>
        </select>
        {(filterCategory || filterOutcome || filterEmail) && (
          <Button variant="ghost" size="sm" onClick={resetFilters} className="h-8 text-xs">
            <Filter className="h-3 w-3" /> Reset
          </Button>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-rose/30 bg-rose/5 p-3 text-sm text-rose">
          {error}
        </div>
      )}

      {/* Log list */}
      <div className="max-h-[28rem] space-y-1.5 overflow-y-auto scroll-slim pr-1">
        {data?.items.length === 0 && !loading && (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Belum ada audit log. Lakukan aksi (login, logout, dll.) untuk mengisi jejak.
          </div>
        )}
        <AnimatePresence initial={false}>
          {data?.items.map((log) => {
            const isExpanded = expandedId === log.id;
            return (
              <motion.div
                key={log.id}
                layout
                className={cn(
                  "rounded-xl border bg-background/60 transition-colors",
                  isExpanded ? "border-rose/30" : "border-border hover:border-border/70",
                )}
              >
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : log.id)}
                  className="flex w-full items-start gap-3 p-3 text-left"
                >
                  <span className="mt-0.5 shrink-0">{outcomeIcon(log.outcome)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <code className="truncate text-xs font-700 text-foreground">{log.action}</code>
                      <Badge variant="outline" className={cn("h-4 px-1.5 text-[0.6rem] font-700 uppercase", outcomeBadgeClass(log.outcome))}>
                        {log.outcome}
                      </Badge>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{log.description}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.65rem] text-muted-foreground/80">
                      <span>{formatTime(log.createdAt)}</span>
                      {log.actorEmail && <span>· {log.actorEmail}</span>}
                      {log.actorRole && (
                        <span className={cn("rounded px-1 py-px font-700", roleBadgeClass(log.actorRole))}>
                          {log.actorRole}
                        </span>
                      )}
                      {log.ipAddress && <span>· {log.ipAddress}</span>}
                    </div>
                  </div>
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
                      isExpanded && "rotate-180",
                    )}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden border-t border-border/60 px-3 py-2.5"
                    >
                      <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-2">
                        <div>
                          <dt className="font-600 text-muted-foreground">ID</dt>
                          <dd className="font-mono text-[0.65rem]">{log.id}</dd>
                        </div>
                        <div>
                          <dt className="font-600 text-muted-foreground">Target</dt>
                          <dd className="font-mono text-[0.65rem]">
                            {log.targetType ? `${log.targetType}:${log.targetId}` : "—"}
                          </dd>
                        </div>
                        <div>
                          <dt className="font-600 text-muted-foreground">IP</dt>
                          <dd className="font-mono text-[0.65rem]">{log.ipAddress ?? "—"}</dd>
                        </div>
                        <div>
                          <dt className="font-600 text-muted-foreground">User-Agent</dt>
                          <dd className="truncate font-mono text-[0.65rem]">{log.userAgent ?? "—"}</dd>
                        </div>
                        {log.metadata && (
                          <div className="sm:col-span-2">
                            <dt className="font-600 text-muted-foreground">Metadata</dt>
                            <dd>
                              <pre className="mt-0.5 max-h-32 overflow-auto rounded-lg bg-muted p-2 text-[0.6rem] scroll-slim">
                                {JSON.stringify(log.metadata, null, 2)}
                              </pre>
                            </dd>
                          </div>
                        )}
                      </dl>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Load more */}
      {data?.nextCursor && (
        <div className="mt-3 text-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchLogs(data.nextCursor)}
            disabled={loading}
            className="h-8"
          >
            {loading ? "Memuat…" : "Muat lebih banyak"}
          </Button>
        </div>
      )}
    </section>
  );
}
