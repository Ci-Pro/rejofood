/**
 * POST /api/upload
 *
 * Upload image to Cloudinary. Returns { url, publicId }.
 *
 * Body: FormData with:
 *  - file: File (image only, max 5MB)
 *  - folder: string (optional, default "rejofood")
 *
 * Auth: requires login (any role)
 */
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/context";
import { logAction, getRequestMeta } from "@/lib/auth/audit";
import { uploadToCloudinary, isCloudinaryConfigured } from "@/lib/cloudinary";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) {
    return NextResponse.json({ error: "Unauthorized. Login required." }, { status: 401 });
  }

  if (!isCloudinaryConfigured()) {
    return NextResponse.json(
      {
        error: "Image upload belum dikonfigurasi. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET di environment variables.",
        code: "CLOUDINARY_NOT_CONFIGURED",
      },
      { status: 503 },
    );
  }

  const meta = getRequestMeta(req);

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const folder = (formData.get("folder") as string) || "rejofood";

    if (!file) {
      return NextResponse.json({ error: "File tidak ditemukan." }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Format tidak didukung. Gunakan: ${ALLOWED_TYPES.join(", ")}` },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `Ukuran file maksimal ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 },
      );
    }

    const result = await uploadToCloudinary(file, `rejofood/${folder}`);

    await logAction({
      actorId: me.id,
      actorEmail: me.email,
      actorRole: me.role,
      category: "upload",
      action: "upload.image",
      description: `Image uploaded: ${result.publicId} (${file.type}, ${file.size} bytes)`,
      targetId: result.publicId,
      targetType: "image",
      outcome: "success",
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: {
        publicId: result.publicId,
        url: result.url,
        size: file.size,
        type: file.type,
        folder,
      },
    });

    return NextResponse.json({
      url: result.url,
      publicId: result.publicId,
    });
  } catch (err) {
    console.error("[upload] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal upload image." },
      { status: 500 },
    );
  }
}
