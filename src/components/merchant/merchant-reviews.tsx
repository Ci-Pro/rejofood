"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Star, MessageSquare, Send, Loader2, RefreshCw, Quote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ReviewItem {
  id: string;
  rating: number;
  comment: string | null;
  merchantReply: string | null;
  merchantReplyAt: string | null;
  customerName: string;
  orderCode: string;
  createdAt: string;
}

export function MerchantReviews() {
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch own menu to get merchantId, then fetch reviews
      const menuRes = await fetch("/api/merchant/menu", { cache: "no-store" });
      const menuData = await menuRes.json();
      if (!menuRes.ok || !menuData.merchant?.id) {
        setError("Gagal memuat data merchant.");
        return;
      }

      const reviewsRes = await fetch(`/api/restaurants/${menuData.merchant.id}/reviews?limit=50`, { cache: "no-store" });
      const reviewsData = await reviewsRes.json();
      if (!reviewsRes.ok) {
        setError(reviewsData?.error || "Gagal memuat ulasan.");
        return;
      }

      // Fetch order codes for each review
      const reviewsWithOrders = await Promise.all(
        reviewsData.items.map(async (r: { id: string; rating: number; comment: string | null; merchantReply: string | null; merchantReplyAt: string | null; customerName: string; createdAt: string }) => {
          // We don't have order code in reviews endpoint, skip for now
          return { ...r, orderCode: "—" };
        })
      );

      setReviews(reviewsWithOrders);
    } catch {
      setError("Koneksi bermasalah.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  async function submitReply(reviewId: string) {
    if (replyText.trim().length < 2) {
      toast.error("Reply minimal 2 karakter.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/reviews/${reviewId}/reply`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reply: replyText.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || "Gagal mengirim balasan.");
        return;
      }
      toast.success("Balasan terkirim!");
      // Update local state
      setReviews((prev) => prev.map((r) =>
        r.id === reviewId
          ? { ...r, merchantReply: replyText.trim(), merchantReplyAt: new Date().toISOString() }
          : r
      ));
      setReplyingId(null);
      setReplyText("");
    } catch {
      toast.error("Koneksi bermasalah.");
    } finally {
      setSubmitting(false);
    }
  }

  function formatTime(iso: string): string {
    return new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
  }

  const avgRating = reviews.length > 0
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : "—";

  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-card">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="accent-lavender flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-role text-role-fg">
            <MessageSquare className="h-4.5 w-4.5" strokeWidth={2.2} />
          </span>
          <div>
            <h3 className="font-display text-lg font-700 text-foreground">Ulasan Pelanggan</h3>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Star className="h-3 w-3 fill-primary text-primary" />
              <span className="font-700 text-foreground">{avgRating}</span>
              · {reviews.length} ulasan
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchReviews} disabled={loading} className="h-8">
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
        </Button>
      </header>

      {error && (
        <div className="mb-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-muted/50" />
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center">
          <MessageSquare className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm font-600 text-foreground">Belum ada ulasan</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Ulasan dari customer akan muncul di sini setelah pesanan selesai.
          </p>
        </div>
      ) : (
        <div className="max-h-[32rem] space-y-2.5 overflow-y-auto scroll-slim pr-1">
          <AnimatePresence>
            {reviews.map((r, idx) => (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx * 0.03, 0.3) }}
                className="rounded-xl border border-border bg-background/60 p-3"
              >
                {/* Customer info + rating */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-lavender/15 text-xs font-700 text-lavender">
                      {r.customerName[0]?.toUpperCase()}
                    </span>
                    <span className="text-sm font-700 text-foreground">{r.customerName}</span>
                  </div>
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={cn(
                          "h-3 w-3",
                          s <= r.rating ? "fill-primary text-primary" : "fill-muted text-muted-foreground",
                        )}
                      />
                    ))}
                  </div>
                </div>

                {/* Comment */}
                {r.comment && (
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    <Quote className="mr-1 inline h-3 w-3 text-muted-foreground/50" />
                    {r.comment}
                  </p>
                )}

                <p className="mt-1.5 text-[0.6rem] text-muted-foreground/60">{formatTime(r.createdAt)}</p>

                {/* Merchant reply (existing) */}
                {r.merchantReply && (
                  <div className="mt-2.5 rounded-lg border border-lavender/20 bg-lavender/5 p-2.5">
                    <p className="text-[0.6rem] font-700 uppercase tracking-wide text-lavender">
                      Balasan Anda
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-foreground">{r.merchantReply}</p>
                    {r.merchantReplyAt && (
                      <p className="mt-1 text-[0.55rem] text-muted-foreground/60">
                        {formatTime(r.merchantReplyAt)}
                      </p>
                    )}
                  </div>
                )}

                {/* Reply form (if not yet replied) */}
                {!r.merchantReply && replyingId === r.id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-2.5 space-y-2"
                  >
                    <Textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Tulis balasan untuk ulasan ini…"
                      rows={2}
                      maxLength={500}
                      className="resize-none text-xs"
                      autoFocus
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-[0.55rem] text-muted-foreground">
                        {replyText.length}/500
                      </span>
                      <div className="flex gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => { setReplyingId(null); setReplyText(""); }}
                          disabled={submitting}
                          className="h-7 text-xs"
                        >
                          Batal
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => submitReply(r.id)}
                          disabled={submitting || replyText.trim().length < 2}
                          className="accent-lavender h-7 bg-role text-role-fg hover:opacity-90 text-xs"
                        >
                          {submitting ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <><Send className="h-3 w-3" /> Kirim</>
                          )}
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Reply button (if not yet replied and not currently replying) */}
                {!r.merchantReply && replyingId !== r.id && (
                  <button
                    type="button"
                    onClick={() => { setReplyingId(r.id); setReplyText(""); }}
                    className="mt-2 flex items-center gap-1 text-[0.65rem] font-600 text-lavender hover:underline"
                  >
                    <MessageSquare className="h-2.5 w-2.5" />
                    Balas ulasan
                  </button>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </section>
  );
}
