import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "@/app/api/upload/route";
import { NextRequest } from "next/server";

// Mock filesystem operations
vi.mock("fs/promises", () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

// Mock auth to allow authorized upload tests
vi.mock("@/lib/auth", () => ({
  verifyAdminSession: vi.fn().mockResolvedValue(true),
}));

function createMockImageFile(name: string, type: string, size = 1024): File {
  const bytes = new Uint8Array(size);
  if (type === "image/jpeg") {
    bytes.set([0xff, 0xd8, 0xff], 0);
  } else if (type === "image/png") {
    bytes.set([0x89, 0x50, 0x4e, 0x47], 0);
  } else if (type === "image/webp") {
    bytes.set([0x52, 0x49, 0x46, 0x46], 0);
  } else if (type === "image/gif") {
    bytes.set([0x47, 0x49, 0x46], 0);
  }
  return new File([bytes], name, { type });
}

describe("Upload API Handler - POST /api/upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should reject when no file is provided", async () => {
    const formData = new FormData();
    const request = new NextRequest("http://localhost:3000/api/upload", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("No file provided");
  });

  it("should reject invalid file types", async () => {
    const formData = new FormData();
    const textFile = new File(["hello"], "test.txt", { type: "text/plain" });
    formData.append("file", textFile);

    const request = new NextRequest("http://localhost:3000/api/upload", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Invalid file type");
  });

  it("should accept valid image types (JPEG, PNG, WebP, GIF)", async () => {
    const validTypes = [
      { type: "image/jpeg", name: "test.jpg" },
      { type: "image/png", name: "test.png" },
      { type: "image/webp", name: "test.webp" },
      { type: "image/gif", name: "test.gif" },
    ];

    for (const { type, name } of validTypes) {
      const formData = new FormData();
      const imageFile = createMockImageFile(name, type, 1024);
      formData.append("file", imageFile);

      const request = new NextRequest("http://localhost:3000/api/upload", {
        method: "POST",
        body: formData,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.url).toContain("/uploads/");
      expect(data.url).toContain(name);
    }
  });

  it("should reject files larger than 5MB", async () => {
    const largeFile = createMockImageFile("large.jpg", "image/jpeg", 6 * 1024 * 1024);
    const formData = new FormData();
    formData.append("file", largeFile);

    const request = new NextRequest("http://localhost:3000/api/upload", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("5MB");
  });

  it("should generate unique filenames with timestamp and random string", async () => {
    const formData = new FormData();
    const imageFile = createMockImageFile("photo.jpg", "image/jpeg", 1024);
    formData.append("file", imageFile);

    const request = new NextRequest("http://localhost:3000/api/upload", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.url).toContain("/uploads/");
    // Check that filename includes timestamp and random string
    const urlParts = data.url.split("/uploads/")[1];
    expect(/^\d+-[a-z0-9]+-/.test(urlParts)).toBe(true);
  });

  it("should return correct response structure on success", async () => {
    const formData = new FormData();
    const imageFile = createMockImageFile("pet.jpg", "image/jpeg", 2048);
    formData.append("file", imageFile);

    const request = new NextRequest("http://localhost:3000/api/upload", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty("success");
    expect(data).toHaveProperty("url");
    expect(data).toHaveProperty("filename");
    expect(data).toHaveProperty("size");
    expect(typeof data.success).toBe("boolean");
    expect(typeof data.url).toBe("string");
    expect(typeof data.filename).toBe("string");
    expect(typeof data.size).toBe("number");
    expect(data.size).toBe(2048);
  });

  it("should handle special characters in filename", async () => {
    const formData = new FormData();
    const imageFile = createMockImageFile("my photo (2).jpg", "image/jpeg", 512);
    formData.append("file", imageFile);

    const request = new NextRequest("http://localhost:3000/api/upload", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.filename).not.toContain("(");
    expect(data.filename).not.toContain(")");
  });

  it("should handle concurrent uploads", async () => {
    const uploadPromises = Array.from({ length: 3 }).map((_, i) => {
      const formData = new FormData();
      const imageFile = createMockImageFile(`pet${i}.jpg`, "image/jpeg", 512);
      formData.append("file", imageFile);

      const request = new NextRequest("http://localhost:3000/api/upload", {
        method: "POST",
        body: formData,
      });

      return POST(request).then((res) => res.json());
    });

    const results = await Promise.all(uploadPromises);

    expect(results).toHaveLength(3);
    results.forEach((data) => {
      expect(data.success).toBe(true);
      expect(data.url).toContain("/uploads/");
    });

    // Check that filenames are unique
    const urls = results.map((r) => r.url);
    const uniqueUrls = new Set(urls);
    expect(uniqueUrls.size).toBe(3);
  });
});

