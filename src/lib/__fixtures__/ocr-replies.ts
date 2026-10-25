// Model replies for the three apps' layouts, as Claude sends them back for
// `ocrPrompt()`. Used by the OCR unit tests; e2e specs answer `/api/ocr`
// with the parsed lines instead.

/** BCA mutations list: DB/CR marks, a GoPay top-up paid from BCA, wrapped in a code fence. */
export const BCA_REPLY = `\`\`\`json
[
  {"date": "2026-10-20", "store": "KOPI KENANGAN", "description": "QRIS", "amount": 45000, "amountText": "45.000,00 DB", "direction": "out", "ownTransfer": false},
  {"date": "2026-10-21", "store": "TRSF E-BANKING CR ANDI", "description": "Dinner split", "amount": 150000, "amountText": "150.000,00 CR", "direction": "in", "ownTransfer": false},
  {"date": "2026-10-22", "store": "GOPAY TOPUP", "description": "", "amount": 200000, "amountText": "200.000,00 DB", "direction": "out", "ownTransfer": true}
]
\`\`\``;

/** GoPay history: a top-up received, a payment with a minus sign, an amount that couldn't be read. */
export const GOPAY_REPLY = `[
  {"date": "2026-10-22", "store": "Top up from BCA", "description": "", "amount": 200000, "amountText": "+Rp200.000", "direction": "in", "ownTransfer": true},
  {"date": "2026-10-23", "store": "GoFood Bakmi GM", "description": "", "amount": 87450, "amountText": "-Rp87.450", "direction": "out", "ownTransfer": false},
  {"date": "2026-10-23", "store": "GoRide", "description": "", "amount": null, "amountText": "-Rp1?.0?0", "direction": "out", "ownTransfer": false}
]`;

/** Krom history: a transfer to the owner's BCA, interest coming in, an amount sent as text and a date without a year read wrong. */
export const KROM_REPLY = `Here are the transactions:
[
  {"date": "2026-10-24", "store": "Transfer to BCA Gregory", "description": "", "amount": "Rp1.250.000", "amountText": "-Rp1.250.000", "direction": "out", "ownTransfer": true},
  {"date": "2026-10-25", "store": "Interest", "description": "Bunga harian", "amount": 1234, "amountText": "+Rp1.234", "direction": "in", "ownTransfer": false},
  {"date": "24 Oct", "store": "Tokopedia", "description": "", "amount": 99000, "amountText": "-Rp99.000", "direction": "out"}
]`;
