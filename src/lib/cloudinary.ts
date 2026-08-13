/**
 * Cloudinary helper — unsigned upload via upload preset.
 *
 * Flow:
 *  1. Client select file → POST /api/upload with FormData (file + folder)
 *  2. Server upload to Cloudinary via unsigned upload preset
 *  3. Return secure URL → client store URL to DB
 *
 * Env vars:
 *  CLOUDINARY_CLOUD_NAME — dari Cloudinary dashboard
 *  CLOUDINARY_UPLOAD_PRESET — unsigned upload preset (buat di Cloudinary settings)
 *
 * Setup:
 *  1. Cloudinary dashboard → Settings → Upload → Upload presets
 *  2. Add new preset → name: "rejofood" → Signing Mode: UNSIGNED
 *  3. Set folder: "rejofood" → Save
 *  4. Set env: CLOUDINARY_CLOUD_NAME + CLOUDINARY_UPLOAD_PRESET
 */

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || "";
const UPLOAD_PRESET = process.env.CLOUDINARY_UPLOAD_PRESET || "rejofood";

export function isCloudinaryConfigured(): boolean {
  return !!(CLOUD_NAME && UPLOAD_PRESET);
}

/**
 * Upload file to Cloudinary via unsigned upload preset.
 * Simpler + more reliable than signed upload — no API secret needed.
 */
export async function uploadToCloudinary(
  file: File,
  folder: string = "rejofood",
): Promise<{ url: string; publicId: string }> {
  if (!isCloudinaryConfigured()) {
    throw new Error("Cloudinary belum dikonfigurasi. Set CLOUDINARY_CLOUD_NAME dan CLOUDINARY_UPLOAD_PRESET di .env");
  }

  // Convert File to base64 data URI
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const base64 = buffer.toString("base64");
  const dataURI = `data:${file.type};base64,${base64}`;

  // Upload via Cloudinary API — unsigned upload (no signature needed)
  const formData = new FormData();
  formData.append("file", dataURI);
  formData.append("upload_preset", UPLOAD_PRESET);
  // folder is set in the preset, but override if needed
  formData.append("folder", `rejofood/${folder}`);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const errText = await res.text();
    let errMsg = `Cloudinary upload failed (${res.status})`;
    try {
      const errJson = JSON.parse(errText);
      errMsg = errJson.error?.message || errMsg;
    } catch {
      errMsg = errText.substring(0, 300);
    }
    throw new Error(errMsg);
  }

  const data = await res.json();
  return {
    url: data.secure_url as string,
    publicId: data.public_id as string,
  };
}

/**
 * Build optimized URL from Cloudinary public ID or URL.
 */
export function cloudinaryUrl(
  publicIdOrUrl: string,
  options?: {
    width?: number;
    height?: number;
    crop?: "fill" | "fit" | "limit" | "scale";
    quality?: number;
    format?: "auto" | "webp" | "jpg" | "png";
  },
): string {
  if (!publicIdOrUrl) return "";
  if (publicIdOrUrl.startsWith("http")) return publicIdOrUrl;
  if (!CLOUD_NAME) return publicIdOrUrl;

  const { width, height, crop = "fill", quality = "auto", format = "auto" } = options ?? {};
  const transforms: string[] = [];

  if (width) transforms.push(`w_${width}`);
  if (height) transforms.push(`h_${height}`);
  if (width || height) transforms.push(`c_${crop}`);
  transforms.push(`q_${quality}`);
  transforms.push(`f_${format}`);

  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${transforms.join(",")}/${publicIdOrUrl}`;
}
