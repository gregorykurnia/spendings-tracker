// Reads real screenshots through the real Claude API and prints what it
// found, so the owner can check the reading before trusting it. Writes
// nothing anywhere. Never run by tests (it costs money and needs a key).
//
//   ANTHROPIC_API_KEY=... npm run ocr:try <folder>
//
// Every .png, .jpg, .jpeg, .webp and .gif in the folder is read, one at a time.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { OcrUnreadableError, readScreenshot, type OcrMediaType } from "../src/lib/ocr";

const MEDIA_TYPES: Record<string, OcrMediaType> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

async function main() {
  const folder = process.argv[2];
  if (!folder) {
    console.error("Usage: npm run ocr:try <folder of screenshots>");
    process.exit(1);
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Set ANTHROPIC_API_KEY first: ANTHROPIC_API_KEY=... npm run ocr:try <folder>");
    process.exit(1);
  }

  const files = (await readdir(folder)).sort();
  const images = files.filter((f) => MEDIA_TYPES[path.extname(f).toLowerCase()]);
  const skipped = files.filter((f) => !images.includes(f) && !f.startsWith("."));
  if (skipped.length) {
    console.log(`Skipping (not png, jpg, webp or gif): ${skipped.join(", ")}\n`);
  }
  if (!images.length) {
    console.error(`No screenshots in ${folder}`);
    process.exit(1);
  }

  for (const file of images) {
    const image = (await readFile(path.join(folder, file))).toString("base64");
    const mediaType = MEDIA_TYPES[path.extname(file).toLowerCase()];
    console.log(`── ${file}`);
    try {
      const lines = await readScreenshot({ image, mediaType });
      if (!lines.length) {
        console.log("   Nothing found\n");
        continue;
      }
      console.table(
        lines.map((l) => ({
          date: l.date || "(none)",
          store: l.store,
          note: l.description,
          amount: l.amount ?? "(unreadable)",
          printed: l.amountText,
          direction: l.direction,
          "own transfer": l.ownTransfer ? "yes" : "",
        }))
      );
      console.log();
    } catch (err) {
      if (!(err instanceof OcrUnreadableError)) throw err;
      console.log(`   Couldn't read this one: ${err.message}`);
      if (err.cause) console.log(`   ${err.cause instanceof Error ? err.cause.message : String(err.cause)}`);
      console.log();
    }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
