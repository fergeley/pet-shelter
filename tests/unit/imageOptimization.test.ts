import { describe, it, expect } from "vitest";
import { optimizeImageForUpload, isWebPSupported } from "@/lib/client/imageOptimization";

describe("Client-Side Image Optimization Utility", () => {
  it("should detect WebP support safely in non-browser/test environment", () => {
    const supported = isWebPSupported();
    expect(typeof supported).toBe("boolean");
  });

  it("should bypass optimization for non-image files", async () => {
    const textFile = new File(["dummy text content"], "notes.txt", { type: "text/plain" });
    const result = await optimizeImageForUpload(textFile);

    expect(result.converted).toBe(false);
    expect(result.file.name).toBe("notes.txt");
    expect(result.compressionRatio).toBe(0);
  });

  it("should preserve animated GIF files without converting", async () => {
    const gifFile = new File([new Uint8Array([0x47, 0x49, 0x46])], "cute-cat.gif", {
      type: "image/gif",
    });
    const result = await optimizeImageForUpload(gifFile);

    expect(result.converted).toBe(false);
    expect(result.file.name).toBe("cute-cat.gif");
    expect(result.file.type).toBe("image/gif");
  });

  it("should gracefully handle fallback when canvas or DOM Image is unavailable", async () => {
    const jpegFile = new File([new Uint8Array([0xff, 0xd8, 0xff])], "dog.jpg", {
      type: "image/jpeg",
    });
    const result = await optimizeImageForUpload(jpegFile);

    expect(result.file).toBeDefined();
    expect(result.originalSize).toBe(3);
  });
});
