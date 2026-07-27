/**
 * Public shape of the authenticated user — never expose passwordHash to the client.
 */
export interface SafeUser {
  id: string;
  email: string;
  phone: string | null;
  fullName: string;
  role: "CUSTOMER" | "MERCHANT" | "DRIVER" | "ADMIN";
  avatarUrl: string | null;
  isActive: boolean;
}

export interface SessionPayload {
  user: SafeUser;
  expiresAt: number; // epoch ms
}

export interface LoginPayload {
  email: string;
  password: string;
  /** Optional: enforce that the user logging in has this role */
  expectedRole?: "CUSTOMER" | "MERCHANT" | "DRIVER" | "ADMIN";
}

export interface RegisterPayload {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  role: "CUSTOMER" | "MERCHANT" | "DRIVER" | "ADMIN";
  /** Merchant-only */
  restaurantName?: string;
  /** Driver-only */
  vehicleType?: "motorcycle" | "car" | "bicycle";
}
