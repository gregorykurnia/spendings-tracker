import { NextRequest, NextResponse } from "next/server";

const EXTRACTION_PROMPT =
  "Extract all transactions from this BCA banking screenshot. For each transaction return: date (YYYY-MM-DD), store (merchant or transfer name), description (any additional note), amount (number only, no formatting). Return as JSON array only, no other text.";

type ExtractedTransaction = {
  date: string;
  store: string;
  description: string;
  amount: number;
};

export async function POST(req: NextRequest) {
  const { image, mediaType } = await req.json();

  if (!image || !mediaType) {
    return NextResponse.json({ error: "Missing image" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: image },
            },
            { type: "text", text: EXTRACTION_PROMPT },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("Claude API error:", errText);
    return NextResponse.json({ error: "OCR extraction failed" }, { status: 502 });
  }

  const data = await res.json();
  const text = data.content?.[0]?.text ?? "[]";

  let transactions: ExtractedTransaction[];
  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    transactions = JSON.parse(jsonMatch ? jsonMatch[0] : text);
  } catch (err) {
    console.error("Failed to parse OCR JSON:", text, err);
    return NextResponse.json({ error: "Could not parse extracted transactions" }, { status: 502 });
  }

  return NextResponse.json({ transactions });
}
