import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  LocalStorageProvider,
  S3StorageProvider,
  CloudinaryStorageProvider,
  getStorageProvider,
} from "@/lib/storage";

// Mock filesystem operations
vi.mock("fs/promises", () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined),
}));

describe("Storage Providers Abstraction", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("LocalStorageProvider", () => {
    it("should write file to local disk and return relative url", async () => {
      const provider = new LocalStorageProvider("public/uploads");
      const buffer = Buffer.from("test image content");
      const result = await provider.uploadFile(buffer, "test-dog.webp", "image/webp");

      expect(result.provider).toBe("local");
      expect(result.filename).toBe("test-dog.webp");
      expect(result.url).toBe("/uploads/test-dog.webp");
      expect(result.size).toBe(buffer.length);
      expect(result.mimeType).toBe("image/webp");
    });

    it("should sanitize filenames with unsafe characters", async () => {
      const provider = new LocalStorageProvider("public/uploads");
      const buffer = Buffer.from("bytes");
      const result = await provider.uploadFile(buffer, "../../../etc/passwd.png", "image/png");

      expect(result.filename).not.toContain("..");
      expect(result.filename).not.toContain("/");
      expect(result.filename).toContain("passwd.png");
    });

    it("should generate correct file URL", () => {
      const provider = new LocalStorageProvider();
      const url = provider.getFileUrl("my-cat.jpg");
      expect(url).toBe("/uploads/my-cat.jpg");
    });

    it("should delete local file successfully", async () => {
      const provider = new LocalStorageProvider();
      const success = await provider.deleteFile("old-pet.jpg");
      expect(success).toBe(true);
    });
  });

  describe("S3StorageProvider", () => {
    it("should construct valid S3 URLs with custom bucket and region", async () => {
      const provider = new S3StorageProvider({
        bucket: "hope-for-strays-bucket",
        region: "ap-southeast-1",
      });

      const buffer = Buffer.from("s3 test image");
      const result = await provider.uploadFile(buffer, "puppy.webp", "image/webp");

      expect(result.provider).toBe("s3");
      expect(result.url).toBe(
        "https://hope-for-strays-bucket.s3.ap-southeast-1.amazonaws.com/puppy.webp"
      );
    });

    it("should support custom CDN / S3 endpoints", () => {
      const provider = new S3StorageProvider({
        cdnUrl: "https://cdn.hopeforstrays.org",
      });

      const url = provider.getFileUrl("bella.webp");
      expect(url).toBe("https://cdn.hopeforstrays.org/bella.webp");
    });
  });

  describe("CloudinaryStorageProvider", () => {
    it("should construct valid Cloudinary URLs", async () => {
      const provider = new CloudinaryStorageProvider("hope-cloud");
      const buffer = Buffer.from("cloudinary test");
      const result = await provider.uploadFile(buffer, "milo-photo.png", "image/png");

      expect(result.provider).toBe("cloudinary");
      expect(result.url).toBe(
        "https://res.cloudinary.com/hope-cloud/image/upload/v1/milo-photo.webp"
      );
    });
  });

  describe("getStorageProvider Factory", () => {
    it("should default to LocalStorageProvider when no env vars configured", () => {
      delete process.env.STORAGE_PROVIDER;
      delete process.env.AWS_S3_BUCKET;
      delete process.env.CLOUDINARY_CLOUD_NAME;

      const provider = getStorageProvider();
      expect(provider.name).toBe("local");
    });

    it("should return S3StorageProvider when configured", () => {
      process.env.STORAGE_PROVIDER = "s3";
      process.env.AWS_S3_BUCKET = "my-test-bucket";

      const provider = getStorageProvider();
      expect(provider.name).toBe("s3");
    });

    it("should return CloudinaryStorageProvider when configured", () => {
      process.env.STORAGE_PROVIDER = "cloudinary";
      process.env.CLOUDINARY_CLOUD_NAME = "my-cloud";

      const provider = getStorageProvider();
      expect(provider.name).toBe("cloudinary");
    });
  });
});
