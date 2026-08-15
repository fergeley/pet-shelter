import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/auth";

const UPLOAD_DIR = "public/uploads";
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// Magic numbers for file validation (file signatures)
const FILE_SIGNATURES: Record<string, Buffer> = {
  "image/jpeg": Buffer.from([0xff, 0xd8, 0xff]),
  "image/png": Buffer.from([0x89, 0x50, 0x4e, 0x47]),
  "image/webp": Buffer.from([0x52, 0x49, 0x46, 0x46]), // RIFF
  "image/gif": Buffer.from([0x47, 0x49, 0x46]), // GIF
};

/**
 * Validates file signature (magic numbers) to prevent MIME type spoofing
 */
async function validateFileSignature(file: File, expectedType: string): Promise<boolean> {
  const signature = FILE_SIGNATURES[expectedType];
  if (!signature) return false;

  const bytes = await file.slice(0, signature.length).arrayBuffer();
  const buffer = Buffer.from(bytes);

  return buffer.subarray(0, signature.length).equals(signature);
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate: verify user is admin
    const isAuthorized = await verifyAdminSession();
    if (!isAuthorized) {
      return NextResponse.json(
        { error: "Unauthorized: Admin access required" },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed." },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File size exceeds 5MB limit" },
        { status: 400 }
      );
    }

    // Validate file signature to prevent MIME type spoofing
    const isValidSignature = await validateFileSignature(file, file.type);
    if (!isValidSignature) {
      return NextResponse.json(
        { error: "File signature validation failed. File content does not match claimed type." },
        { status: 400 }
      );
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const originalName = file.name.replace(/[^a-z0-9.-]/gi, "_");
    const filename = `${timestamp}-${randomStr}-${originalName}`;

    // Ensure upload directory exists
    const uploadPath = join(process.cwd(), UPLOAD_DIR);
    try {
      await mkdir(uploadPath, { recursive: true });
    } catch (error) {
      console.error("Failed to create upload directory:", error);
      throw new Error("Upload directory creation failed");
    }

    // Write file to disk
    const filepath = join(uploadPath, filename);
    const bytes = await file.arrayBuffer();
    await writeFile(filepath, Buffer.from(bytes));

    // Return the URL path
    const url = `/uploads/${filename}`;

    return NextResponse.json(
      {
        success: true,
        url,
        filename,
        size: file.size,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Upload error:", error);

    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}
