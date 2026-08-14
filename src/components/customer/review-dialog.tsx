"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Star, Loader2, CheckCircle2, MessageSquare } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ReviewDialogProps {
  open: boolean;
  onClose: () => void;
  orderId: string;
  orderCode: string;
  restaurantName: string;
  onSubmitted?: () => void;
}

const RATING_LABELS: Record<number, string> = {
  1: "Sangat kecewa",
  2: "Kecewa",
  3: "Biasa saja",
  4: "Puas",
  5: "Sangat puas",
};

export function ReviewDialog({
  open,
  onClose,
  orderId,
  orderCode,
  restaurantName,
  onSubmitted,
}: ReviewDialogProps) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating < 1 || rating > 5) {
      toast.error("Pilih rating 1-5 bintang.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/review`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          rating,
          comment: comment.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || "Gagal submit review.");
        return;
      }
      toast.success(`Review ${rating}★ terkirim!`);
      setSubmitted(true);
      onSubmitted?.();
    } catch {
      toast.error("Koneksi bermasalah.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    // Reset state when closing
    if (!submitting) {
      setRating(0);
      setHoverRating(0);
      setComment("");
      setSubmitted(false);
      onClose();
    }
  }

  const displayRating = hoverRating || rating;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        {submitted ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="py-6 text-center"
          >
            <CheckCircle2 className="mx-auto h-12 w-12 text-mint" />
            <p className="mt-2 font-display text-lg font-700 text-foreground">
              Terima kasih atas penilaianmu!
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Review kamu membantu merchant berkembang dan pelanggan lain memilih.
            </p>
            <Button
              onClick={handleClose}
              className="accent-saffron mt-4 bg-role text-role-fg hover:opacity-90"
            >
              Selesai
            </Button>
          </motion.div>
        ) : (
          <form onSubmit={onSubmit}>
            <DialogHeader>
              <DialogTitle>Beri penilaian</DialogTitle>
              <DialogDescription>
                Order <span className="font-700 text-foreground">{orderCode}</span> ·{" "}
                <span className="font-600 text-foreground">{restaurantName}</span>
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-4">
              {/* Star rating */}
              <div className="text-center">
                <p className="mb-2 text-xs font-600 uppercase tracking-wide text-muted-foreground">
                  Bagaimana pengalamanmu?
                </p>
                <div className="flex justify-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="rounded-lg p-1 transition-transform hover:scale-110"
                      aria-label={`${star} bintang`}
                    >
                      <Star
                        className={cn(
                          "h-9 w-9 transition-colors",
                          star <= displayRating
                            ? "fill-primary text-primary"
                            : "fill-muted text-muted-foreground",
                        )}
                      />
                    </button>
                  ))}
                </div>
                {displayRating > 0 && (
                  <motion.p
                    key={displayRating}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-2 font-display text-sm font-700 text-primary"
                  >
                    {RATING_LABELS[displayRating]}
                  </motion.p>
                )}
              </div>

              {/* Comment */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-600 uppercase tracking-wide text-muted-foreground">
                  <MessageSquare className="h-3 w-3" />
                  Komentar <span className="text-muted-foreground/60">(opsional, maks 500 karakter)</span>
                </label>
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Ceritakan pengalamanmu: rasa, porsi, kecepatan, driver, dll."
                  rows={3}
                  maxLength={500}
                  className="resize-none"
                  disabled={submitting}
                />
                <p className="text-right text-[0.65rem] text-muted-foreground">
                  {comment.length}/500
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose} disabled={submitting}>
                Batal
              </Button>
              <Button
                type="submit"
                disabled={submitting || rating < 1}
                className="accent-saffron bg-role text-role-fg hover:opacity-90"
              >
                {submitting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Mengirim…</>
                ) : (
                  <><Star className="h-4 w-4" /> Kirim penilaian</>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
