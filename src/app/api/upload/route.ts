/**
 * POST /api/upload
 *
 * Server-side file upload dengan validasi ketat sebelum upload ke Cloudinary.
 *
 * Validasi:
 *  1. User harus login (semua role boleh upload — avatar/menu/logo)
 *  2. File wajib ada di FormData
 *  3. Size limit: max 2MB (cukup untuk foto menu/avatar)
 *  4. MIME type check: hanya JPEG, PNG, WebP
 *  5. Magic bytes (file signature) check — cegah file PHP/EXE dipalsukan jadi image
 *  6. File name sanitization
 *  7. Rate limit: 20 upload per menit per user
 *
 * Setelah validasi lolos, upload ke Cloudinary via unsigned preset.
 *
 * Response: { url, publicId, size, mimeType }
 */
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/context";
import { logAction, getRequestMeta } from "@/lib/auth/audit";
import { rateLimitResponse, getClientIp } from "@/lib/auth/api-rate-limiter";
import { isCloudinaryConfigured, uploadToCloudinary } from "@/lib/cloudinary";

// === CONFIG ===
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const MAX_FILE_SIZE_MB = MAX_FILE_SIZE / (1024 * 1024);

// MIME types yang diizinkan
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

// Magic bytes (file signature) untuk verifikasi file asli
// Sumber: https://en.wikipedia.org/wiki/List_of_file_signatures
const MAGIC_BYTES: Record<string, number[]> = {
  "image/jpeg": [0xFF, 0xD8, 0xFF], // JPEG: FF D8 FF
  "image/png": [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], // PNG: ‰PNG\r\n\x1A\n
  "image/webp": [0x52, 0x49, 0x46, 0x46], // RIFF (WebP container)
};

// Folder yang diizinkan (whitelist — prevent arbitrary folder injection)
const ALLOWED_FOLDERS = new Set(["menu", "logo", "avatar", "merchant", "misc"]);

export async function POST(req: Request) {
  // === Auth check ===
  const me = await getCurrentUser();
  if (!me) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // === Rate limit: 20 upload per menit per user ===
  const ip = getClientIp(req);
  const limited = rateLimitResponse(req, `upload:${me.id}`, 20, 60_000);
  if (limited) return limited;

  const meta = getRequestMeta(req);

  try {
    // === Parse FormData ===
    const formData = await req.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json({ error: "FormData tidak valid." }, { status: 400 });
    }

    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "File wajib diupload." }, { status: 400 });
    }

    let folder = String(formData.get("folder") ?? "misc");
    if (!ALLOWED_FOLDERS.has(folder)) {
      folder = "misc"; // fallback kalau folder tidak valid
    }

    // === Size check ===
    if (file.size === 0) {
      return NextResponse.json({ error: "File kosong." }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `Ukuran file maksimal ${MAX_FILE_SIZE_MB}MB. File Anda: ${(file.size / 1024 / 1024).toFixed(2)}MB.` },
        { status: 413 },
      );
    }

    // === MIME type check (deklaratif) ===
    const declaredMime = file.type.toLowerCase();
    if (!ALLOWED_MIME_TYPES.has(declaredMime)) {
      return NextResponse.json(
        {
          error: `Tipe file tidak diizinkan: ${declaredMime || "tidak diketahui"}. Hanya JPEG, PNG, atau WebP.`,
          code: "INVALID_MIME_TYPE",
        },
        { status: 415 },
      );
    }

    // === Magic bytes check (verifikasi file signature) ===
    // Cegah attack: file PHP/EXE dinamai .jpg, MIME type di-spoof
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const expectedMagic = MAGIC_BYTES[declaredMime];
    if (!expectedMagic) {
      return NextResponse.json({ error: "Tipe file tidak didukung." }, { status: 415 });
    }
    const matchesMagic = expectedMagic.every((byte, idx) => bytes[idx] === byte);
    if (!matchesMagic) {
      // ⚠️ File MIME type bilang image, tapi signature tidak cocok — kemungkinan malicious
      await logAction({
        actorId: me.id,
        actorEmail: me.email,
        actorRole: me.role,
        category: "security",
        action: "upload.magic_bytes_mismatch",
        description: `Upload ditolak: MIME ${declaredMime} tapi file signature tidak cocok. Kemungkinan file malicious.`,
        outcome: "denied",
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        metadata: {
          declaredMime,
          fileName: file.name.slice(0, 100),
          fileSize: file.size,
          firstBytes: Array.from(bytes.slice(0, 8)).map((b) => b.toString(16).padStart(2, "0")).join(" "),
        },
      });
      return NextResponse.json(
        {
          error: "File tidak valid. Tipe file tidak sesuai dengan konten.",
          code: "MAGIC_BYTES_MISMATCH",
        },
        { status: 415 },
      );
    }

    // === File name sanitization (untuk log, bukan untuk Cloudinary) ===
    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);

    // === Cloudinary configured check ===
    if (!isCloudinaryConfigured()) {
      return NextResponse.json(
        {
          error: "Upload belum dikonfigurasi. Hubungi admin.",
          code: "CLOUDINARY_NOT_CONFIGURED",
        },
        { status: 503 },
      );
    }

    // === Upload ke Cloudinary ===
    // Re-create File dari validated buffer (file object original sudah ter-consume)
    const validatedFile = new File([arrayBuffer], safeFileName, { type: declaredMime });
    const result = await uploadToCloudinary(validatedFile, folder);

    await logAction({
      actorId: me.id,
      actorEmail: me.email,
      actorRole: me.role,
      category: "upload",
      action: "upload.success",
      description: `Upload image ke folder "${folder}" (${result.publicId}).`,
      outcome: "success",
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: {
        folder,
        publicId: result.publicId,
        mimeType: declaredMime,
        sizeBytes: file.size,
        url: result.url,
      },
    });

    return NextResponse.json({
      url: result.url,
      publicId: result.publicId,
      size: file.size,
      mimeType: declaredMime,
    }, { status: 201 });
  } catch (err) {
    console.error("[upload] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal upload file." },
      { status: 500 },
    );
  }
}
