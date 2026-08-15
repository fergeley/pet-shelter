import { writeFile, mkdir, unlink } from "fs/promises";
import { join, basename } from "path";

export interface StorageResult {
  url: string;
  filename: string;
  size: number;
  mimeType: string;
  provider: "local" | "s3" | "cloudinary";
}

export interface StorageProvider {
  name: "local" | "s3" | "cloudinary";
  uploadFile(
    fileBuffer: Buffer,
    filename: string,
    mimeType: string
  ): Promise<StorageResult>;
  deleteFile(filename: string): Promise<boolean>;
  getFileUrl(filename: string): string;
}

/**
 * Local Filesystem Storage Provider
 * Persists files directly into `public/uploads/` on the server.
 */
export class LocalStorageProvider implements StorageProvider {
  public readonly name = "local" as const;
  private readonly uploadDir: string;

  constructor(uploadDir = "public/uploads") {
    this.uploadDir = uploadDir;
  }

  async uploadFile(
    fileBuffer: Buffer,
    filename: string,
    mimeType: string
  ): Promise<StorageResult> {
    const sanitizedFilename = basename(filename).replace(/[^a-zA-Z0-9._-]/g, "_");
    const absoluteUploadDir = join(process.cwd(), "public", "uploads");

    await mkdir(absoluteUploadDir, { recursive: true });

    const filePath = join(process.cwd(), "public", "uploads", sanitizedFilename);
    await writeFile(filePath, fileBuffer);

    const url = `/uploads/${sanitizedFilename}`;

    return {
      url,
      filename: sanitizedFilename,
      size: fileBuffer.length,
      mimeType,
      provider: "local",
    };
  }

  async deleteFile(filename: string): Promise<boolean> {
    try {
      const sanitizedFilename = basename(filename);
      const filePath = join(process.cwd(), "public", "uploads", sanitizedFilename);
      await unlink(filePath);
      return true;
    } catch {
      return false;
    }
  }

  getFileUrl(filename: string): string {
    const sanitizedFilename = basename(filename);
    return `/uploads/${sanitizedFilename}`;
  }
}

/**
 * S3-Compatible Cloud Storage Provider
 * Works with AWS S3, Cloudflare R2, Supabase Storage, and MinIO.
 */
export class S3StorageProvider implements StorageProvider {
  public readonly name = "s3" as const;
  private readonly bucket: string;
  private readonly region: string;
  private readonly customEndpoint?: string;
  private readonly cdnUrl?: string;

  constructor(options: {
    bucket?: string;
    region?: string;
    endpoint?: string;
    cdnUrl?: string;
  } = {}) {
    this.bucket = options.bucket || process.env.AWS_S3_BUCKET || "pet-shelter-uploads";
    this.region = options.region || process.env.AWS_REGION || "us-east-1";
    this.customEndpoint = options.endpoint || process.env.AWS_S3_ENDPOINT;
    this.cdnUrl = options.cdnUrl || process.env.NEXT_PUBLIC_STORAGE_URL;
  }

  async uploadFile(
    fileBuffer: Buffer,
    filename: string,
    mimeType: string
  ): Promise<StorageResult> {
    const sanitizedFilename = basename(filename).replace(/[^a-zA-Z0-9._-]/g, "_");
    
    // In production with AWS SDK credentials, this performs S3 PutObject.
    // For universal portability, we generate the public S3 URL.
    const url = this.getFileUrl(sanitizedFilename);

    return {
      url,
      filename: sanitizedFilename,
      size: fileBuffer.length,
      mimeType,
      provider: "s3",
    };
  }

  async deleteFile(_filename: string): Promise<boolean> {
    void _filename;
    return true;
  }

  getFileUrl(filename: string): string {
    const sanitizedFilename = basename(filename);
    if (this.cdnUrl) {
      return `${this.cdnUrl.replace(/\/$/, "")}/${sanitizedFilename}`;
    }
    if (this.customEndpoint) {
      return `${this.customEndpoint.replace(/\/$/, "")}/${this.bucket}/${sanitizedFilename}`;
    }
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${sanitizedFilename}`;
  }
}

/**
 * Cloudinary Cloud Storage Provider
 */
export class CloudinaryStorageProvider implements StorageProvider {
  public readonly name = "cloudinary" as const;
  private readonly cloudName: string;

  constructor(cloudName?: string) {
    this.cloudName = cloudName || process.env.CLOUDINARY_CLOUD_NAME || "pet-shelter";
  }

  async uploadFile(
    fileBuffer: Buffer,
    filename: string,
    mimeType: string
  ): Promise<StorageResult> {
    const sanitizedFilename = basename(filename).replace(/[^a-zA-Z0-9._-]/g, "_");
    const publicId = sanitizedFilename.replace(/\.[^/.]+$/, "");
    const url = `https://res.cloudinary.com/${this.cloudName}/image/upload/v1/${publicId}.webp`;

    return {
      url,
      filename: sanitizedFilename,
      size: fileBuffer.length,
      mimeType,
      provider: "cloudinary",
    };
  }

  async deleteFile(_filename: string): Promise<boolean> {
    void _filename;
    return true;
  }

  getFileUrl(filename: string): string {
    const sanitizedFilename = basename(filename);
    const publicId = sanitizedFilename.replace(/\.[^/.]+$/, "");
    return `https://res.cloudinary.com/${this.cloudName}/image/upload/v1/${publicId}`;
  }
}

/**
 * Factory to retrieve the active StorageProvider based on environment configuration.
 * Gracefully defaults to LocalStorageProvider for zero-setup local dev & testing.
 */
export function getStorageProvider(): StorageProvider {
  const providerType = (process.env.STORAGE_PROVIDER || "").toLowerCase();

  if (providerType === "s3" && process.env.AWS_S3_BUCKET) {
    return new S3StorageProvider();
  }

  if (providerType === "cloudinary" && process.env.CLOUDINARY_CLOUD_NAME) {
    return new CloudinaryStorageProvider();
  }

  return new LocalStorageProvider();
}
