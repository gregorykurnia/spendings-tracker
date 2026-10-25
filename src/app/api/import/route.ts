import { collection, doc, getDocs, query, where, writeBatch } from "firebase/firestore";
import { inChunks } from "@/lib/batches";
import { db } from "@/lib/firebase";
import { OcrUnreadableError, readScreenshot } from "@/lib/ocr";
import { readReply, readSharedImage, SHARE_REPLIES, tokenMatches } from "@/lib/share-import";
import { toTransaction, waitingLineDocs } from "@/lib/waiting-lines";
import type { OcrLine } from "@/types";

// A screenshot shared from the iPhone through a Shortcut (docs/iphone-shortcut.md). One image per
// request, as the body or as a form's file, with `Authorization: Bearer $IMPORT_TOKEN`. The lines are
// written as waiting lines, like an import in the app, tagged `importedVia: "share"`. Every answer is
// plain text the Shortcut shows as it is. With no IMPORT_TOKEN set the route is off.

function say(text: string, status = 200) {
  return new Response(text, { status, headers: { "content-type": "text/plain; charset=utf-8" } });
}

/** Writes the lines as one batch of waiting lines, with the category the app would suggest. */
async function saveSharedLines(lines: OcrLine[]) {
  const transactions = collection(db, "transactions");
  const [spends, categories] = await Promise.all([
    getDocs(query(transactions, where("status", "==", "confirmed"))),
    getDocs(collection(db, "categories")),
  ]);
  const docs = waitingLineDocs(lines, {
    spends: spends.docs.map((d) => toTransaction(d.id, d.data())),
    categoryIds: new Set(categories.docs.map((d) => d.id)),
    createdAt: new Date().toISOString(),
    importedVia: "share",
  });
  for (const chunk of inChunks(docs)) {
    const batch = writeBatch(db);
    for (const data of chunk) batch.set(doc(transactions), data);
    await batch.commit();
  }
}

export async function POST(request: Request) {
  const token = process.env.IMPORT_TOKEN?.trim();
  if (!token) return say(SHARE_REPLIES.off, 404);
  if (!tokenMatches(request.headers.get("authorization"), token)) {
    return say(SHARE_REPLIES.notAllowed, 401);
  }

  const shared = await readSharedImage(request);
  if (shared.kind !== "image") {
    if (shared.kind === "too_big") return say(SHARE_REPLIES.tooBig, 413);
    if (shared.kind === "not_image") return say(SHARE_REPLIES.notImage, 415);
    return say(SHARE_REPLIES.missing, 400);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Shared import: ANTHROPIC_API_KEY is not set");
    return say(SHARE_REPLIES.unreadable, 500);
  }

  let lines: OcrLine[];
  try {
    lines = await readScreenshot({ image: shared.image, mediaType: shared.mediaType });
  } catch (err) {
    if (!(err instanceof OcrUnreadableError)) throw err;
    console.error("Shared import: OCR failed:", err.message, err.cause ?? "");
    return say(SHARE_REPLIES.unreadable, 502);
  }
  if (!lines.length) return say(SHARE_REPLIES.nothing);

  try {
    await saveSharedLines(lines);
  } catch (err) {
    console.error("Shared import: saving failed:", err);
    return say(SHARE_REPLIES.notSaved, 500);
  }
  return say(readReply(lines.length));
}
