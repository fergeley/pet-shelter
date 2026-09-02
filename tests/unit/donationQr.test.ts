import { describe, it, expect } from "vitest";
import qrcode from "qrcode-generator";
import {
  isSafeQrImageUrl,
  normalizeQrImageUrl,
  renderQrSvg,
  renderQrDataUri,
  resolveDonationQr,
  QR_PAYLOAD_MAX_LENGTH,
  QR_UPLOAD_MIME_TYPES,
} from "@/lib/domain/qrCode";

/** A realistic DuitNow EMVCo payload. */
const DUITNOW =
  "00020101021126580014A000000615000101065988880212Hope4Strays5204739953034585802MY5916HOPE FOR STRAYS6013PETALING JAYA6304";

describe("isSafeQrImageUrl", () => {
  it("accepts the /uploads/ path that /api/upload actually returns", () => {
    expect(isSafeQrImageUrl("/uploads/1730-ab12-duitnow.png")).toBe(true);
  });

  it("accepts absolute https URLs", () => {
    expect(isSafeQrImageUrl("https://cdn.example.org/qr.png")).toBe(true);
  });

  it("rejects the javascript: scheme that a bare z.string().url() lets through", () => {
    expect(isSafeQrImageUrl("javascript:alert(1)")).toBe(false);
  });

  it("rejects data: URIs", () => {
    expect(isSafeQrImageUrl("data:image/png;base64,AAAA")).toBe(false);
  });

  it("rejects plain http", () => {
    expect(isSafeQrImageUrl("http://example.org/qr.png")).toBe(false);
  });

  it("rejects protocol-relative URLs pointing off-origin", () => {
    expect(isSafeQrImageUrl("//evil.example/qr.png")).toBe(false);
  });

  it("rejects traversal out of the uploads directory", () => {
    expect(isSafeQrImageUrl("/uploads/../../etc/passwd")).toBe(false);
  });

  it("rejects same-origin paths outside /uploads/", () => {
    expect(isSafeQrImageUrl("/admin/settings")).toBe(false);
  });

  it("rejects a bare /uploads/ with no filename", () => {
    expect(isSafeQrImageUrl("/uploads/")).toBe(false);
  });

  it("rejects empty and whitespace-only values", () => {
    expect(isSafeQrImageUrl("")).toBe(false);
    expect(isSafeQrImageUrl("   ")).toBe(false);
  });
});

describe("normalizeQrImageUrl", () => {
  it("maps absent and blank values to null", () => {
    expect(normalizeQrImageUrl(null)).toBeNull();
    expect(normalizeQrImageUrl(undefined)).toBeNull();
    expect(normalizeQrImageUrl("")).toBeNull();
    expect(normalizeQrImageUrl("  ")).toBeNull();
  });

  it("trims a valid value", () => {
    expect(normalizeQrImageUrl("  /uploads/qr.png ")).toBe("/uploads/qr.png");
  });

  it("throws on a present but unsafe value rather than silently dropping it", () => {
    expect(() => normalizeQrImageUrl("javascript:alert(1)")).toThrow();
  });
});

describe("renderQrSvg", () => {
  it("emits a standalone SVG with a square viewBox", () => {
    const svg = renderQrSvg(DUITNOW);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg.endsWith("</svg>")).toBe(true);

    const viewBox = /viewBox="0 0 (\d+) (\d+)"/.exec(svg);
    expect(viewBox).not.toBeNull();
    expect(viewBox![1]).toBe(viewBox![2]);
  });

  it("reproduces the encoder's module matrix exactly", () => {
    // This is the part of the pipeline written by hand: the run-length pass that
    // turns isDark() into <rect> elements. Rebuild the matrix from the emitted
    // rects and compare it against the library's own matrix, so a bug in the
    // packing shows up as a mismatched module rather than an unscannable code.
    const cellSize = 4;
    const margin = 4;
    const svg = renderQrSvg(DUITNOW, { cellSize, margin });

    const qr = qrcode(0, "M");
    qr.addData(DUITNOW);
    qr.make();
    const count = qr.getModuleCount();

    const painted: boolean[][] = Array.from({ length: count }, () =>
      new Array<boolean>(count).fill(false)
    );

    const rectRe = /<rect x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)"\/>/g;
    let match: RegExpExecArray | null;
    while ((match = rectRe.exec(svg)) !== null) {
      const [x, y, width, height] = match.slice(1).map(Number);
      expect(height).toBe(cellSize);
      const col = x / cellSize - margin;
      const row = y / cellSize - margin;
      for (let i = 0; i < width / cellSize; i++) {
        painted[row][col + i] = true;
      }
    }

    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        expect(painted[row][col]).toBe(qr.isDark(row, col));
      }
    }
  });

  it("packs horizontal runs instead of emitting one rect per module", () => {
    const svg = renderQrSvg(DUITNOW);
    const qr = qrcode(0, "M");
    qr.addData(DUITNOW);
    qr.make();

    let darkModules = 0;
    const count = qr.getModuleCount();
    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        if (qr.isDark(row, col)) darkModules++;
      }
    }

    const rects = (svg.match(/<rect /g) || []).length - 1; // minus the background
    expect(rects).toBeLessThan(darkModules);
  });

  it("keeps an opaque background, since a transparent QR will not scan", () => {
    expect(renderQrSvg(DUITNOW)).toContain('fill="#ffffff"');
  });

  it("enforces the ISO/IEC 18004 minimum quiet zone of 4 modules", () => {
    const svg = renderQrSvg(DUITNOW, { cellSize: 1, margin: 0 });
    const qr = qrcode(0, "M");
    qr.addData(DUITNOW);
    qr.make();
    const size = Number(/viewBox="0 0 (\d+)/.exec(svg)![1]);
    expect(size).toBe(qr.getModuleCount() + 8);
  });

  it("escapes the accessible title rather than interpolating markup", () => {
    const svg = renderQrSvg(DUITNOW, { title: '<script>alert("x")</script>' });
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;script&gt;");
  });

  it("falls back to a safe colour when handed a CSS injection attempt", () => {
    const svg = renderQrSvg(DUITNOW, { foreground: '"/><script>x</script>' });
    expect(svg).not.toContain("<script>");
    expect(svg).toContain('fill="#18181b"');
  });

  it("rejects an empty payload", () => {
    expect(() => renderQrSvg("")).toThrow();
    expect(() => renderQrSvg("   ")).toThrow();
  });

  it("rejects a payload beyond the documented maximum", () => {
    expect(() => renderQrSvg("A".repeat(QR_PAYLOAD_MAX_LENGTH + 1))).toThrow();
  });

  it("produces a data URI usable as an img src", () => {
    const uri = renderQrDataUri(DUITNOW);
    expect(uri.startsWith("data:image/svg+xml;charset=utf-8,")).toBe(true);
    expect(decodeURIComponent(uri.split(",")[1])).toContain("<svg");
  });
});

describe("resolveDonationQr", () => {
  it("prefers an animal's dedicated fund-drive QR over everything else", () => {
    const result = resolveDonationQr({
      petCustomQrUrl: "/uploads/bruno-fund.png",
      petName: "Bruno",
      shelterQrUrl: "/uploads/shelter.png",
      paymentPayload: DUITNOW,
    });

    expect(result.kind).toBe("pet-image");
    expect(result.isPetSpecific).toBe(true);
    if (result.kind === "pet-image") {
      expect(result.imageUrl).toBe("/uploads/bruno-fund.png");
      expect(result.caption).toContain("Bruno");
    }
  });

  it("falls back to the shelter image when the animal has none", () => {
    const result = resolveDonationQr({
      shelterQrUrl: "/uploads/shelter.png",
      paymentPayload: DUITNOW,
    });
    expect(result.kind).toBe("shelter-image");
    expect(result.isPetSpecific).toBe(false);
  });

  it("generates from the payment payload when no image is uploaded", () => {
    const result = resolveDonationQr({ paymentPayload: DUITNOW });
    expect(result.kind).toBe("generated");
    if (result.kind === "generated") {
      expect(result.svg).toContain("<svg");
    }
  });

  it("falls back to the placeholder when nothing is configured", () => {
    expect(resolveDonationQr({}).kind).toBe("placeholder");
  });

  it("skips an unsafe pet QR instead of rendering it", () => {
    const result = resolveDonationQr({
      petCustomQrUrl: "javascript:alert(1)",
      shelterQrUrl: "/uploads/shelter.png",
    });
    expect(result.kind).toBe("shelter-image");
  });

  it("skips an unsafe shelter QR instead of rendering it", () => {
    const result = resolveDonationQr({
      shelterQrUrl: "//evil.example/qr.png",
      paymentPayload: DUITNOW,
    });
    expect(result.kind).toBe("generated");
  });

  it("degrades to the placeholder rather than throwing on an unencodable payload", () => {
    const result = resolveDonationQr({
      paymentPayload: "A".repeat(QR_PAYLOAD_MAX_LENGTH + 1),
    });
    expect(result.kind).toBe("placeholder");
  });

  it("treats whitespace-only values as unset", () => {
    expect(
      resolveDonationQr({ petCustomQrUrl: "   ", shelterQrUrl: "  ", paymentPayload: " " }).kind
    ).toBe("placeholder");
  });
});

describe("QR upload MIME types", () => {
  it("excludes SVG, which would be stored XSS when served from /uploads/", () => {
    expect(QR_UPLOAD_MIME_TYPES).not.toContain("image/svg+xml");
  });

  it("covers the raster formats a bank app exports", () => {
    expect(QR_UPLOAD_MIME_TYPES).toContain("image/png");
    expect(QR_UPLOAD_MIME_TYPES).toContain("image/jpeg");
  });
});
