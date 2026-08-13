/**
 * Cloudinary helper — server-side signed upload.
 *
 * Flow:
 *  1. Client select file → POST /api/upload with FormData (file + folder)
 *  2. Server sign upload with CLOUDINARY_API_SECRET
 *  3. Upload directly to Cloudinary API
 *  4. Return secure URL → client store URL to DB (imageUrl/logoUrl field)
 *
 * Env vars:
 *  CLOUDINARY_CLOUD_NAME — dari Cloudinary dashboard
 *  CLOUDINARY_API_KEY
 *  CLOUDINARY_API_SECRET
 *
 * Setup: https://cloudinary.com → sign up free → dashboard → copy credentials
 */

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || "";
const API_KEY = process.env.CLOUDINARY_API_KEY || "";
const API_SECRET = process.env.CLOUDINARY_API_SECRET || "";

export function isCloudinaryConfigured(): boolean {
  return !!(CLOUD_NAME && API_KEY && API_SECRET);
}

/**
 * Upload file to Cloudinary via server-side API call.
 * Uses unsigned upload with signature for security.
 */
export async function uploadToCloudinary(
  file: File,
  folder: string = "rejofood",
): Promise<{ url: string; publicId: string }> {
  if (!isCloudinaryConfigured()) {
    throw new Error("Cloudinary belum dikonfigurasi. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET di .env");
  }

  // Convert File to base64
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const base64 = buffer.toString("base64");
  const dataURI = `data:${file.type};base64,${base64}`;

  // Generate timestamp + signature
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = await generateSignature({ timestamp, folder }, API_SECRET);

  // Upload via Cloudinary API
  const formData = new FormData();
  formData.append("file", dataURI);
  formData.append("api_key", API_KEY);
  formData.append("timestamp", String(timestamp));
  formData.append("signature", signature);
  formData.append("folder", folder);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Cloudinary upload failed: ${err.substring(0, 200)}`);
  }

  const data = await res.json();
  return {
    url: data.secure_url as string,
    publicId: data.public_id as string,
  };
}

/**
 * Generate SHA-256 signature for Cloudinary upload.
 * Signature = SHA-256(params_to_sort_and_join + api_secret)
 */
async function generateSignature(params: Record<string, string | number>, apiSecret: string): Promise<string> {
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");

  const crypto = await import("node:crypto");
  return crypto
    .createHash("sha256")
    .update(sorted + apiSecret)
    .digest("hex");
}

/**
 * Build optimized URL from Cloudinary public ID.
 * Supports transformations: width, height, crop, quality, format.
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

  // If already a full URL, return as-is (e.g., from other sources)
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
