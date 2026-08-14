/**
 * Password policy validator.
 *
 * Aturan password RejoFood (production-grade):
 *  1. Minimal 8 karakter
 *  2. Harus mengandung huruf (a-z atau A-Z)
 *  3. Harus mengandung angka (0-9)
 *  4. Maksimal 100 karakter (mencegah DoS via password panjang)
 *
 * Opsional (tidak diwajibkan untuk UX yang lebih baik):
 *  - Symbol (!@#$%^&*) — direkomendasikan tapi tidak wajib
 *  - Mix huruf besar & kecil — direkomendasikan tapi tidak wajib
 *
 * Reasoning: penelitian NIST 800-63B menunjukkan panjang > kombinasi.
 * 8 karakter + angka sudah cukup untuk baseline, sisanya disarankan via UI hint.
 */

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 100;

export interface PasswordValidation {
  valid: boolean;
  errors: string[];
  /** Strength score 0-4 (untuk UI feedback, bukan validation) */
  strength: 0 | 1 | 2 | 3 | 4;
  /** Label strength untuk UI */
  strengthLabel: "Lemah" | "Kurang" | "Cukup" | "Bagus" | "Kuat";
}

export function validatePassword(password: string): PasswordValidation {
  const errors: string[] = [];

  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Password minimal ${PASSWORD_MIN_LENGTH} karakter.`);
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    errors.push(`Password maksimal ${PASSWORD_MAX_LENGTH} karakter.`);
  }
  if (!/[a-zA-Z]/.test(password)) {
    errors.push("Password harus mengandung huruf.");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Password harus mengandung angka.");
  }

  // Strength score (untuk UI hint)
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  const strength = Math.min(4, score) as 0 | 1 | 2 | 3 | 4;

  const labels: PasswordValidation["strengthLabel"][] = ["Lemah", "Kurang", "Cukup", "Bagus", "Kuat"];

  return {
    valid: errors.length === 0,
    errors,
    strength,
    strengthLabel: labels[strength],
  };
}

/**
 * Hash password dengan bcrypt. Salt rounds = 12 (balance security vs performance).
 * Lebih tinggi = lebih aman tapi lebih lambat.
 */
export const BCRYPT_SALT_ROUNDS = 12;
