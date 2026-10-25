# Decisions

## Proposals

**P1 (adopted 2026-10-25). Merge "accept one" and "accept all" (R3, R7) into one Accept concept with a scope.**
Same action, same word; the scope is one line or everything that looks right. All three directions already show it this way. 

**P2 (adopted 2026-10-25). Merge R4, R9 and R10 into one "needs a look" concept.**
Throwing something away, a likely repeat and money coming in are three reasons a line isn't a normal spend. One concept means one place, one reason line in plain words and the same two ways out: throw it away, or keep it. Direction B groups them; A puts them last in the queue; C flags them in place. 

**P3 (adopted 2026-10-25). Treat R6 (corrections kept if interrupted) as a rule, not a feature.**
Nothing to see or tap: edits to a waiting line are saved as they happen. It stays in the design notes as behaviour. 

**P4 (adopted 2026-10-25). One form for R2, F6 and C2.**
Correcting a waiting line, changing a saved one and typing one by hand use the same fields (date, store, amount, category, note). Design it once and reuse it. 

Adopted when the owner said "I'll go with your rec" after the designer recommended yes to all four. If that was meant for the direction only, say so and these go back to open.

## Stage 1 choice (2026-10-25)
- **Chosen:** B (Daybook) with C's "From the screenshot" crop in the open row, built as `directions/d-daybook-crop`.
- **Reason:** the designer's recommendation, which the owner accepted: fewest taps for the daily job (a tick per row plus accept all), no tab bar, and the crop is the real check against a misread amount, date or name (R1). The owner has not given a reason of their own yet.
- **Owner note:** a stray extra space in the "Add screenshots" button; fixed in B and D.
- **Next:** one screenshot round for D (`! ./shoot redesign/design/directions/d-daybook-crop`), then the prototype.

## Choices made in stage 1 (for the record)
- The mock batch is ordered so the five clean lines come first in A and B; C keeps the bank's own order.
- Store names are shown exactly as the bank writes them (capitals, stars, codes). Everything else is sentence case.
- The screenshot in C is a generic bank list with no bank branding.
