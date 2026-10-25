import { isOcrMediaType, OcrUnreadableError, readScreenshot } from "@/lib/ocr";

// One screenshot per request.
//   200 { transactions: OcrLine[] }  ([] means "Nothing found")
//   any other status { error }       ("Couldn't read this one")
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const image = body?.image;
  const mediaType = body?.mediaType;
  if (typeof image !== "string" || !image || !isOcrMediaType(mediaType)) {
    return Response.json({ error: "missing_image" }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "not_configured" }, { status: 500 });
  }

  try {
    const transactions = await readScreenshot({ image, mediaType });
    return Response.json({ transactions });
  } catch (err) {
    if (!(err instanceof OcrUnreadableError)) throw err;
    console.error("OCR failed:", err.message, err.cause ?? "");
    return Response.json({ error: "unreadable" }, { status: 502 });
  }
}
