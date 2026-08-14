/**
 * Order ETA helper — estimasi waktu sampai untuk display di customer/driver UI.
 *
 * Calculation:
 *  - PENDING: estimasi total (prepTime + deliveryTime)
 *  - ACCEPTED/PREPARING: sisa waktu dari acceptedAt
 *  - READY: tinggal menunggu driver pickup
 *  - PICKED_UP: estimasi tiba dari pickedUpAt + deliveryTime
 *  - DELIVERED: tampilkan deliveredAt
 *  - CANCELLED: tidak ada ETA
 */

export interface OrderETA {
  /** Total estimasi menit dari sekarang, atau null jika tidak relevan */
  minutesRemaining: number | null;
  /** Estimasi waktu sampai (Date), atau null */
  estimatedArrival: Date | null;
  /** Label untuk UI */
  label: string;
  /** Apakah order sudah selesai/cancelled */
  isCompleted: boolean;
}

const DEFAULT_PREP_TIME = 15; // menit
const DEFAULT_DELIVERY_TIME = 20; // menit

export function calculateOrderETA(order: {
  status: string;
  createdAt: string | Date;
  acceptedAt?: string | Date | null;
  readyAt?: string | Date | null;
  pickedUpAt?: string | Date | null;
  deliveredAt?: string | Date | null;
  cancelledAt?: string | Date | null;
  merchant?: { prepTime?: number | null } | null;
}): OrderETA {
  const now = new Date();
  const created = new Date(order.createdAt);
  const prepTime = order.merchant?.prepTime ?? DEFAULT_PREP_TIME;
  const deliveryTime = DEFAULT_DELIVERY_TIME;

  if (order.status === "DELIVERED" && order.deliveredAt) {
    return {
      minutesRemaining: 0,
      estimatedArrival: new Date(order.deliveredAt),
      label: "Selesai",
      isCompleted: true,
    };
  }

  if (order.status === "CANCELLED") {
    return {
      minutesRemaining: null,
      estimatedArrival: null,
      label: "Dibatalkan",
      isCompleted: true,
    };
  }

  // Estimasi total = prep + delivery
  const totalMinutes = prepTime + deliveryTime;

  if (order.status === "PENDING") {
    const estimatedArrival = new Date(created.getTime() + totalMinutes * 60 * 1000);
    const remaining = Math.max(0, Math.round((estimatedArrival.getTime() - now.getTime()) / 60000));
    return {
      minutesRemaining: remaining,
      estimatedArrival,
      label: `~${remaining} menit`,
      isCompleted: false,
    };
  }

  if (order.status === "ACCEPTED" || order.status === "PREPARING") {
    const baseTime = order.acceptedAt ? new Date(order.acceptedAt) : created;
    const estimatedArrival = new Date(baseTime.getTime() + totalMinutes * 60 * 1000);
    const remaining = Math.max(0, Math.round((estimatedArrival.getTime() - now.getTime()) / 60000));
    return {
      minutesRemaining: remaining,
      estimatedArrival,
      label: `~${remaining} menit`,
      isCompleted: false,
    };
  }

  if (order.status === "READY") {
    const remaining = deliveryTime;
    const estimatedArrival = new Date(now.getTime() + remaining * 60 * 1000);
    return {
      minutesRemaining: remaining,
      estimatedArrival,
      label: `~${remaining} menit`,
      isCompleted: false,
    };
  }

  if (order.status === "PICKED_UP" && order.pickedUpAt) {
    const pickedUp = new Date(order.pickedUpAt);
    const estimatedArrival = new Date(pickedUp.getTime() + deliveryTime * 60 * 1000);
    const remaining = Math.max(0, Math.round((estimatedArrival.getTime() - now.getTime()) / 60000));
    return {
      minutesRemaining: remaining,
      estimatedArrival,
      label: `~${remaining} menit`,
      isCompleted: false,
    };
  }

  // Fallback
  return {
    minutesRemaining: totalMinutes,
    estimatedArrival: new Date(created.getTime() + totalMinutes * 60 * 1000),
    label: `~${totalMinutes} menit`,
    isCompleted: false,
  };
}

/**
 * Format ETA untuk display singkat (mis. "35m", "1j 5m")
 */
export function formatETA(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}j ${m}m` : `${h}j`;
}
