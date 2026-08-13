/**
 * Payment gateway abstraction.
 *
 * Saat ini pakai MOCK_GATEWAY — tidak butuh credentials, simulasi untuk dev.
 *
 * Production swap: ganti implementasi `createPaymentCharge` dan `verifyWebhook`
 * ke Midtrans Snap API atau Xendit Invoice API. Signature function tetap sama,
 * jadi API routes tidak perlu diubah.
 *
 * Mock behavior:
 *  - COD: langsung SUCCESS (customer bayar cash ke driver saat sampai)
 *  - WALLET (RejoPay): langsung SUCCESS (saldo di-debit atomic saat createPayment)
 *  - QRIS/VA/E-wallet: PENDING + generate mock payment URL
 *    User klik "Saya sudah bayar" via mock-notify endpoint → SUCCESS
 *  - Expiry: 15 menit untuk online methods (mirip Midtrans default)
 */
import { PaymentMethod, PaymentStatus } from "@prisma/client";

export interface CreatePaymentInput {
  paymentCode: string;     // PAY-XXXXXX
  orderId: string;
  orderCode: string;       // RF-XXXXXX
  amount: number;
  method: PaymentMethod;
  customerName: string;
  customerEmail: string;
}

export interface CreatePaymentResult {
  gatewayReference: string;
  paymentUrl: string | null;  // null untuk COD
  expiresAt: Date | null;
  metadata: Record<string, unknown>;
}

export interface WebhookPayload {
  gatewayReference: string;
  transactionStatus: "settlement" | "pending" | "deny" | "expire" | "cancel" | "refund";
  paymentMethod: string;
  rawPayload: Record<string, unknown>;
}

const ONLINE_METHODS: PaymentMethod[] = [
  "QRIS", "VA_BCA", "VA_MANDIRI", "VA_BNI",
  "EWALLET_GOPAY", "EWALLET_OVO", "EWALLET_DANA",
];

const EXPIRY_MINUTES = 15;

function generateGatewayRef(method: PaymentMethod, code: string): string {
  const prefix = method.startsWith("VA") ? "VA" : method.startsWith("EWALLET") ? "EW" : "QR";
  const rand = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `MOCK-${prefix}-${code}-${rand}`;
}

function vaNumber(method: PaymentMethod, code: string): string {
  // Mock VA number — 12 digit
  const bankPrefix: Record<string, string> = {
    VA_BCA: "8077",
    VA_MANDIRI: "8822",
    VA_BNI: "9881",
  };
  const base = bankPrefix[method] ?? "0000";
  const rand = Math.floor(Math.random() * 99999999).toString().padStart(8, "0");
  return base + rand + code.replace(/[^0-9]/g, "").slice(0, 4).padStart(4, "0");
}

/**
 * Buat charge di payment gateway.
 *
 * - COD: langsung return tanpa gatewayReference (will be set to mock-COD-...)
 * - Online methods: generate mock gateway reference + payment URL
 */
export async function createPaymentCharge(input: CreatePaymentInput): Promise<CreatePaymentResult> {
  // COD — bayar cash ke driver
  if (input.method === "COD") {
    return {
      gatewayReference: `MOCK-COD-${input.paymentCode}`,
      paymentUrl: null,
      expiresAt: null, // COD tidak expire
      metadata: {
        gateway: "mock",
        method: "COD",
        instruction: "Bayar cash ke driver saat pesanan tiba.",
      },
    };
  }

  // WALLET (RejoPay) — pembayaran internal, langsung SUCCESS.
  // Saldo di-debit atomic di /api/payment/create route sebelum panggil ini.
  // Di sini kita cuma return metadata — tidak ada URL pembayaran eksternal.
  if (input.method === "WALLET") {
    return {
      gatewayReference: `WALLET-${input.paymentCode}`,
      paymentUrl: null,
      expiresAt: null, // Wallet payment instant
      metadata: {
        gateway: "internal",
        method: "WALLET",
        instruction: "Pembayaran langsung dari saldo RejoPay.",
      },
    };
  }

  // Online methods
  const gatewayReference = generateGatewayRef(input.method, input.paymentCode);
  const expiresAt = new Date(Date.now() + EXPIRY_MINUTES * 60 * 1000);

  // Method-specific metadata (mirip Midtrans Snap response)
  let metadata: Record<string, unknown> = {
    gateway: "mock",
    method: input.method,
  };
  let paymentUrl: string | null = null;

  if (input.method === "QRIS") {
    paymentUrl = `https://mock-gateway.rejofood.id/qris/${input.paymentCode}`;
    metadata = {
      ...metadata,
      qrString: `00020101021126570011...MOCK-QRIS-${input.paymentCode}`,
      merchantName: "RejoFood",
      instruction: "Scan QR dengan e-wallet atau m-banking apapun.",
    };
  } else if (input.method.startsWith("VA_")) {
    const va = vaNumber(input.method, input.paymentCode);
    metadata = {
      ...metadata,
      vaNumber: va,
      bankName: input.method.replace("VA_", ""),
      instruction: `Transfer ke VA ${va} via ${input.method.replace("VA_", "Bank ")}.`,
    };
    paymentUrl = `https://mock-gateway.rejofood.id/va/${input.paymentCode}`;
  } else if (input.method.startsWith("EWALLET_")) {
    const wallet = input.method.replace("EWALLET_", "");
    paymentUrl = `https://mock-gateway.rejofood.id/ewallet/${wallet.toLowerCase()}/${input.paymentCode}`;
    metadata = {
      ...metadata,
      walletName: wallet,
      instruction: `Buka app ${wallet}, scan QR atau bayar via deeplink.`,
      deeplink: `${wallet.toLowerCase()}://pay?ref=${input.paymentCode}`,
    };
  }

  return {
    gatewayReference,
    paymentUrl,
    expiresAt,
    metadata,
  };
}

/**
 * Verify webhook signature (untuk konfirmasi dari gateway).
 *
 * Mock: selalu valid (untuk dev). Production: verify HMAC SHA512 signature header.
 */
export function verifyWebhookSignature(_payload: string, _signature: string): boolean {
  // Mock: selalu valid
  return true;
}

/**
 * Map status dari gateway (Midtrans/Xendit terminology) ke PaymentStatus internal.
 */
export function mapGatewayStatus(status: WebhookPayload["transactionStatus"]): PaymentStatus {
  switch (status) {
    case "settlement":
      return PaymentStatus.SUCCESS;
    case "pending":
      return PaymentStatus.PENDING;
    case "deny":
    case "expire":
    case "cancel":
      return PaymentStatus.FAILED;
    case "refund":
      return PaymentStatus.REFUNDED;
    default:
      return PaymentStatus.PENDING;
  }
}

export function isOnlineMethod(method: PaymentMethod): boolean {
  return ONLINE_METHODS.includes(method);
}

export function isCOD(method: PaymentMethod): boolean {
  return method === "COD";
}

/** Label Indonesia untuk display. */
export function methodLabel(method: PaymentMethod): string {
  const map: Record<PaymentMethod, string> = {
    COD: "Cash (COD)",
    WALLET: "RejoPay (Saldo)",
    QRIS: "QRIS",
    VA_BCA: "Virtual Account BCA",
    VA_MANDIRI: "Virtual Account Mandiri",
    VA_BNI: "Virtual Account BNI",
    EWALLET_GOPAY: "GoPay",
    EWALLET_OVO: "OVO",
    EWALLET_DANA: "DANA",
  };
  return map[method] ?? method;
}

/** Cek apakah payment perlu instruks pembayaran online (bukan COD/WALLET). */
export function needsOnlineAction(method: PaymentMethod): boolean {
  return method !== "COD" && method !== "WALLET";
}

/** Cek apakah method adalah pembayaran internal (langsung SUCCESS tanpa gateway). */
export function isInternalMethod(method: PaymentMethod): boolean {
  return method === "COD" || method === "WALLET";
}
