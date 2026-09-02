import * as z from "zod";
import { isSafeQrImageUrl, QR_PAYLOAD_MAX_LENGTH } from "@/lib/domain/qrCode";

/**
 * Shared validators for image locations produced by `/api/upload`.
 *
 * `/api/upload` returns a same-origin path like `/uploads/1730-ab12-qr.webp`.
 * A bare `z.string().url()` rejects that path outright while happily accepting
 * `javascript:alert(1)`, so every image field in the app uses these instead.
 */

const UPLOAD_URL_MESSAGE =
  "Must be an uploaded image path (/uploads/...) or an absolute https:// URL";

/** A required image location: an upload path or an https URL. */
export const uploadedImageUrl = z
  .string()
  .trim()
  .min(1, "An image is required")
  .refine(isSafeQrImageUrl, UPLOAD_URL_MESSAGE);

/** An optional image location. Empty string means "not set". */
export const optionalUploadedImageUrl = z
  .string()
  .trim()
  .refine((value) => value === "" || isSafeQrImageUrl(value), UPLOAD_URL_MESSAGE)
  .optional()
  .default("");

/** An optional payment payload rendered into a QR code. */
export const optionalQrPayload = z
  .string()
  .trim()
  .max(
    QR_PAYLOAD_MAX_LENGTH,
    `Payment payload must be ${QR_PAYLOAD_MAX_LENGTH} characters or fewer`
  )
  .optional()
  .default("");
