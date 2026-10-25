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

**P5 (built in the prototype, waiting for the owner's yes or no). Every line that can't be accepted yet goes in "Need a look", not only the three in P2.**
Added reasons: the amount couldn't be read, no category yet, and (rarely) a missing store or date. Each shows one plain reason and two buttons: the fix first ("Add amount", "Choose category"), then "Throw away". "Accept the 5 that look right" then always means exactly the lines in "Look right", with nothing hidden that would fail. Say no and these lines go back into the main list with a disabled tick instead.

**P6 (built in the prototype, waiting for the owner's yes or no). Incoming money offers "It's a spend", not "Count it".**
Direction D had "Count it" on incoming money, which contradicts R10 (never counted as spending). The only reason to keep such a line is that the bank's CR/DB was misread, so the button says what the person is declaring: "It's a spend". It then moves to "Look right" and still needs the tick. A repeat's second button stays "Keep it" and works the same way.

## Stage 1 choice (2026-10-25)
- **Chosen:** B (Daybook) with C's "From the screenshot" crop in the open row, built as `directions/d-daybook-crop`.
- **Reason:** the designer's recommendation, which the owner accepted: fewest taps for the daily job (a tick per row plus accept all), no tab bar, and the crop is the real check against a misread amount, date or name (R1). The owner has not given a reason of their own yet.
- **Owner note:** a stray extra space in the "Add screenshots" button; fixed in B and D.
- **Approved:** the owner approved D on 2026-10-25. Stage 1 is closed; next is the prototype (stage 2).

## Choices made in stage 1 (for the record)
- The mock batch is ordered so the five clean lines come first in A and B; C keeps the bank's own order.
- Store names are shown exactly as the bank writes them (capitals, stars, codes). Everything else is sentence case.
- The screenshot in C is a generic bank list with no bank branding.

## Stage 2, group 1: capture and review (2026-10-25)
Choices that follow from the approved direction; none changes the inventory.
- **Import lives in a tray at the top of the inbox** (C3, C4): one row per screenshot with a thumbnail, "Waiting / Reading… / Found 4 transactions / Couldn't read this one / Nothing found". "Add" is greyed while it runs so the same screenshots aren't sent twice, and the tray says "Keep this open until it's done." A failed one offers "Try again" and "Type in a spend"; one with nothing in it offers "Type in a spend". Lines from finished screenshots appear below straight away.
- **Lines keep the order they arrived in** (the bank's own order), never re-sorted, so a second screenshot finishing can't push the row you are about to tick.
- **Typing in a spend (C2) is not next to "Add"**, since screenshots are the daily job. It's in the list of links under the glance, in the menu, in the "All checked" panel and on a failed or empty screenshot.
- **One form for C2, R2 and F6 (P4).** A waiting line saves as you type (P3): the form says "Changes are kept as you go", the buttons are "Done" and "Accept". A typed-in spend has "Cancel" and "Add spend"; a saved one "Cancel" and "Save changes". The main button stays visibly off while something is missing, with one line saying what ("Still needed: store and amount."); field errors show after leaving a field or after a try.
- **A second colour for "wrong"**: a brick red used only for no amount, field errors and (later) deleting. Lemon stays "look at this". Contrast is 5.8:1 or better.
- **Category chips**: the first three or four of the owner's order, then "More" for all 16. The chosen one is always visible. "Suggested from the store name" shows until the person touches the category (R8).
- **"Nothing waiting" (All checked)** is designed in this group because the inbox owns it. First use, loading, failed to load and no connection stay in group 5.
- **Toasts** only for "Accepted 5. Rp 1.765.450 added." and for a typed-in spend. A single tick has no toast: the row leaves, the count drops and the glance total moves.

### Questions for the owner (each has a default, nothing waits on them)
1. **No undo, no confirmation on "Throw away" for waiting lines.** Default: as built. A thrown-away line can be brought back by adding that screenshot again. (F7 still confirms once for saved ones.)
2. **No undo after accepting.** Default: none; a wrong one is fixed or deleted later (F6, F7). An undo bar for accept and throw away would be a small follow-up if you want it.
3. **Working name and mark** "Daybook" are still a placeholder until branding is decided.

