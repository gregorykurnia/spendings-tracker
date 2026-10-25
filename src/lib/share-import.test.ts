import { describe, expect, it } from "vitest";
import { MAX_IMAGE_BYTES, readReply, readSharedImage, sniffMediaType, tokenMatches } from "./share-import";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2]);

function share(body: BodyInit, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/import", { method: "POST", body, headers });
}

describe("tokenMatches", () => {
  it("takes the right token after Bearer", () => {
    expect(tokenMatches("Bearer s3cret-token", "s3cret-token")).toBe(true);
    expect(tokenMatches("bearer s3cret-token ", "s3cret-token")).toBe(true);
  });

  it("refuses a wrong, missing or malformed token", () => {
    expect(tokenMatches("Bearer s3cret-tokeN", "s3cret-token")).toBe(false);
    expect(tokenMatches("Bearer s3cret", "s3cret-token")).toBe(false);
    expect(tokenMatches("s3cret-token", "s3cret-token")).toBe(false);
    expect(tokenMatches("Bearer ", "s3cret-token")).toBe(false);
    expect(tokenMatches(null, "s3cret-token")).toBe(false);
    expect(tokenMatches("Bearer x", "")).toBe(false);
  });
});

describe("sniffMediaType", () => {
  it("knows the image types the reader takes", () => {
    expect(sniffMediaType(PNG)).toBe("image/png");
    expect(sniffMediaType(JPEG)).toBe("image/jpeg");
    expect(sniffMediaType(new TextEncoder().encode("GIF89a..."))).toBe("image/gif");
    expect(sniffMediaType(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
  });

  it("refuses anything else, such as HEIC or text", () => {
    expect(sniffMediaType(new TextEncoder().encode("\0\0\0\x18ftypheic"))).toBeNull();
    expect(sniffMediaType(new TextEncoder().encode("hello"))).toBeNull();
  });
});

describe("readSharedImage", () => {
  it("reads a raw body whatever its content type says", async () => {
    const got = await readSharedImage(share(PNG, { "content-type": "application/octet-stream" }));
    expect(got).toEqual({ kind: "image", image: Buffer.from(PNG).toString("base64"), mediaType: "image/png" });
  });

  it("reads the first file of a form", async () => {
    const form = new FormData();
    form.append("note", "hi");
    form.append("file", new Blob([JPEG], { type: "image/jpeg" }), "shot.jpg");
    const got = await readSharedImage(share(form));
    expect(got).toMatchObject({ kind: "image", mediaType: "image/jpeg" });
  });

  it("says what is wrong with anything else", async () => {
    expect(await readSharedImage(share(new Uint8Array()))).toEqual({ kind: "missing" });
    const form = new FormData();
    form.append("note", "hi");
    expect(await readSharedImage(share(form))).toEqual({ kind: "missing" });
    expect(await readSharedImage(share("hello"))).toEqual({ kind: "not_image" });
    const big = new Uint8Array(MAX_IMAGE_BYTES + 1);
    big.set(PNG);
    expect(await readSharedImage(share(big))).toEqual({ kind: "too_big" });
  });
});

describe("readReply", () => {
  it("says how many were read", () => {
    expect(readReply(4)).toBe("Read 4 transactions. They're waiting in Daybook.");
    expect(readReply(1)).toBe("Read 1 transaction. It's waiting in Daybook.");
  });
});
