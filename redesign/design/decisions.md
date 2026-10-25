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

**P5 (adopted 2026-10-25, with the owner's approval of group 1). Every line that can't be accepted yet goes in "Need a look", not only the three in P2.**
Added reasons: the amount couldn't be read, no category yet, and (rarely) a missing store or date. Each shows one plain reason and two buttons: the fix first ("Add amount", "Choose category"), then "Throw away". "Accept the 5 that look right" then always means exactly the lines in "Look right", with nothing hidden that would fail. Say no and these lines go back into the main list with a disabled tick instead.

**P6 (adopted 2026-10-25, with the owner's approval of group 1). Incoming money offers "It's a spend", not "Count it".**
Direction D had "Count it" on incoming money, which contradicts R10 (never counted as spending). The only reason to keep such a line is that the bank's CR/DB was misread, so the button says what the person is declaring: "It's a spend". It then moves to "Look right" and still needs the tick. A repeat's second button stays "Keep it" and works the same way.

**P7 (adopted 2026-10-25, with the owner's approval of groups 2 and 3). U8 and F6 are one thing: tapping a saved spend anywhere opens the same "Change spend" form.**
"Open that transaction to check or correct it" (U8) and "change a saved transaction" (F6) end in the same place, so there is no separate read-only detail screen. Tapping one of the biggest spends, a row in a category's list, or (group 3) a row in All transactions opens the form with its fields filled in. Say no and U8 gets a read-only detail view with a "Change" button in front of the form.

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

**Approved:** the owner approved group 1 on 2026-10-25 after looking at it. P5 and P6 are built into it, so they count as adopted; if "Approved" was meant for the look only, they go back to open. The three questions below stay on their defaults.

### Questions for the owner (each has a default, nothing waits on them)
1. **No undo, no confirmation on "Throw away" for waiting lines.** Default: as built. A thrown-away line can be brought back by adding that screenshot again. (F7 still confirms once for saved ones.)
2. **No undo after accepting.** Default: none; a wrong one is fixed or deleted later (F6, F7). An undo bar for accept and throw away would be a small follow-up if you want it.
3. **Working name and mark** "Daybook" are still a placeholder until branding is decided.

## Stage 2, group 2: understand (2026-10-25)
- **Order on the screen follows what you said you glance at**: the total and its comparison, then where the money went, then day by day, then the biggest spends. On desktop the categories sit in a right-hand column beside the rest.
- **One total, one comparison** (U1, U2): the big number, then "Rp 475.650 lower" with an arrow, then "1 to 25 September was Rp 7.318.000". While a period runs it is compared with the same number of days of the one before. No green or red: spending more isn't an error. The glance card on home says the same thing in one line.
- **Week or month, earlier or later** (U6): a Week/Month switch and an arrow either side of the period name. Switching keeps the date you were looking at. "Later" is off in the current period, and a "Back to this month/week" button appears when you've gone back.
- **Categories show the top five, "Show N more" for the rest** (U3), to keep the screen quiet. Each has its emoji on its colour, the amount and share, and a bar in that colour. Tapping one opens its spends (U7).
- **Day by day** (U4) is bars, with the exact amount for one day shown above them. Slide a finger or the mouse along the bars, or use the arrows beside the amount: a month of 31 bars is too narrow to tap one at a time. It starts on the biggest day, tagged "Biggest day" in lemon, so a spike is already pointed out. A day with no spending is a flat mark and says "Nothing spent". Days still to come in a running month are faint marks that can't be picked.
- **Biggest spends** (U5) are five rows: store, date and category, amount. Tapping one opens it (U8, see P7).
- **A category's spends in a period** (U7) is the first version of All transactions: the same rows, filtered. Group 3 adds search, filters, ordering and deleting to it.
- **States**: no spending in the period says so and, if lines are still waiting, points at them (they count once accepted). "Nothing to compare with" replaces the comparison when the period before had nothing. Transactions whose category no longer exists are counted under "No category" so totals still add up; group 3 designs how to fix them.
- **Large numbers**: a total of ten digits or more drops to a smaller size so it fits a phone.
- **Stress data** (`?stress`) now also has 240 extra saved spends, with store names that have no spaces, amounts up to Rp 48.250.000, no notes, and seven whose category no longer exists.

### Questions for the owner (defaults, nothing waits)
1. **Top five categories by default.** Default: as built. Showing all sixteen at once would make the screen longer, not clearer.
2. **Bars are the same colour except the one you are looking at.** Default: as built; a category colour per bar would add colour without adding information.

## Stage 2, group 3: find and fix (2026-10-25)
Built on P7: tapping a row anywhere opens the same "Change spend" form. If P7 is turned down, the rows open a read-only view first.
- **One screen, All transactions.** The list that group 2 opened from a category is now this screen with filters already on: arriving from Spending with "Food & Drink, October so far" shows those as two chips you can remove. Opening it from a menu starts with nothing filtered.
- **Search (F1)** looks in the store and the note as you type, all words must match, capitals don't matter, and the matching letters are highlighted. It has its own clear button and is not counted as a filter.
- **Filters (F2, F3)** are in a sheet (a dialog on desktop) and apply as you go. The main button says what you'll see ("Show 23 spends", or "No spends match"). Dates: All time, A day, A week, A month (step earlier or later, or jump to any date) or Custom (a start and an end, either can be left open). Categories: tap several. Amount: at least and at most. Source: Any, Screenshot, Typed in.
- **Filters that are on stay visible** (F3): a number on the Filters button and one lemon chip each under the search box, each removable, plus "Clear all". Lemon because they hide things.
- **Order (F4)** is a menu beside Filters: Newest first, Oldest first, Highest amount, Lowest amount.
- **A row at a glance (F5):** the category's emoji on its colour, the store as the bank wrote it, "Category · note", the amount, the date, and a small icon for where it came from (picture = screenshot, pencil = typed in, each with a hidden text for screen readers). The year shows only when it isn't this year. 60 rows at a time with "Show 60 more".
- **Change (F6)** is the shared form; it now also says "Added from a screenshot" or "Typed in by hand".
- **Delete (F7)** is the last thing in the Change form. One question follows: "Delete this spend?" showing the store, date and amount, "It is removed for good and stops counting in your totals.", buttons "Cancel" (focused) and "Delete". While deleting it says "Deleting…" and can't be dismissed. Then a short "Deleted …" message.
- **No results:** "No spends match." with what was asked ("Nothing for "zzz" with 1 filter on.") and one button, "Clear search and filters".
- **Missing category:** its row shows a grey ❔ and "No category" in the alert colour; "No category" is a filter choice whenever one exists, and Spending links to it. The form says "That category was removed. Choose another." and can't be saved until one is chosen.

### Questions for the owner (defaults, nothing waits)
1. **Filters open in a sheet on desktop too.** Default: as built. A permanent panel beside the list would suit a wide screen better but is a second layout to maintain.
2. **The source marks are icons only** (with hidden text for screen readers). Default: as built; a word next to the icon on desktop is an easy addition.
3. **Search does not look at categories or amounts**, as asked (store or note); the filters cover those.

**Approved:** the owner said groups 2 and 3 "look fine" on 2026-10-25. P7 is built into both, so it counts as adopted; if that was meant for the look only, it goes back to open. The default answers to the questions under groups 2 and 3 stand.

## Stage 2, group 4: organise (2026-10-25)
- **Categories screen** (O5): one row per category, in your order: emoji on its colour, the name, and how many spends it has ("23 spends", or "No spends yet"). Tap one to change it. "Add category" is at the top, like "Add" on home.
- **Order (O4)** is a "Change order" mode with an up and a down arrow on each row (no dragging, which is hard on a phone and impossible by keyboard). A dashed line after the fourth row says "Quick choices end here", because the first four are the chips you see when checking a spend. "Done" leaves the mode.
- **One form to add or change (O2, O3, P4's idea again):** a live preview of the category, its name, an emoji (28 to tap, or type or paste any one), and one of 13 colours. A new category starts with a tag emoji and the colour used least so far, so only the name can be missing ("Still needed: a name."). Changing one says "Changes show on every spend in this category", and it does: every screen reads the same list. A new category goes at the end, and the message says so.
- **Delete (O6)** starts from the change form, and asks first. It checks whether the category is used ("Checking if it is used…"), then either "No spends use it. It is removed for good." with Cancel and Delete, or "69 spends use it. 1 waiting line does too. Choose where they go first." with the other fifteen categories to pick from and no default. The button reads "Choose a category" until one is picked, then "Move 70 and delete". While it runs it says "Moving and deleting…" and can't be dismissed. Waiting lines move with the spends, and any filter on the deleted category is dropped. The last remaining category has no delete button.
- **First open (O1):** a whole-screen "Setting up", the mark, "Adding your starter categories. This takes a moment.", sixteen small tiles that fill with their emoji and colour, and "9 of 16". Nothing else is on screen. Whole-app states like this one are `state.boot` in the prototype; group 5 uses the same hook for first use, loading, failed to load and no connection.
- **Bug fixed along the way:** editing a category in one prototype state no longer shows up in the next state you jump to.

### Questions for the owner (defaults, nothing waits)
1. **Arrows, not dragging, for the order.** Default: as built. Dragging could be added on top for mouse users.
2. **Two categories can't have the same name** (capitals ignored). You didn't ask for this; it stops two identical-looking choices in every picker. Default: as built.
3. **A new category goes at the end of the list**, so it doesn't change your quick choices. Default: as built.

## Stage 2, group 5: app-wide states, stress data, installable (2026-10-25)
- **First use:** home says "Add your first spending" with three numbered steps (take a screenshot, add it, check what was found; numbered because it is a sequence) and both ways in. The empty total card is hidden. Spending and All transactions each say there is nothing yet and point back to where to start. This is not the same as "All checked", which still means you have spends and nothing is waiting.
- **Loading:** the layout of the screen in grey, with the top bar already there, so nothing jumps when the data arrives. A slow, gentle pulse (still when motion is reduced). Screen readers hear "Loading your transactions", "your spending" or "your categories".
- **Failed to load:** names what failed ("Couldn't load your transactions" or "…categories"), says "Something went wrong while loading. Try again in a moment." and has one button that shows "Trying again…". It doesn't apologise and doesn't promise anything about your data.
- **No connection, opening the app:** a whole screen: "No connection. Daybook needs the internet to load your spending. Check your connection, then try again." In the prototype the first "Try again" fails ("Still no connection.") and the second works, so both can be seen.
- **No connection, using the app:** a lemon notice under the top bar on every screen ("No connection. You can look around. Adding, saving, deleting and importing wait until you are online."). Lemon, not red: it's a situation, not a mistake. The app is read-only meanwhile: the tick, accept all, throw away, keep, changing a category, adding screenshots and reordering are dimmed and answer with "No connection. Try again when you are back online."; the note field can't be typed in. Forms and delete questions stay open with what was typed and say, in an alert, "No connection. Nothing was saved. Try again when you are back online."
- **Installable:** a web app manifest (standalone, the ground colour for theme and start-up background), icons drawn from the mark (192, 512, a full-bleed one for round or squircle masks, and the iPhone one), the status bar left default, safe-area spacing at the top, and no pull-to-refresh. With no browser around it, every screen under home has its own back link.
- **Stress data (`?stress`) now covers every state:** 48 waiting lines, 507 saved spends (unspaced names up to 90 characters, amounts to Rp 48.250.000, empty notes, seven with a deleted category), a 60-character category name, and twelve screenshots in the import tray. Long names now wrap inside pills, chips and messages instead of running off the screen. The markup of every state is checked under stress; it still needs eyes.
- **For the build, not the design:** opening offline needs a service worker that keeps the app shell. The prototype can't show that for real (service workers need https), so the offline screens are drawn as screens.

### Questions for the owner (defaults, nothing waits)
1. **Read-only while offline.** The inventory says data can't load, save or import offline, so I made nothing queue up for later. Default: as built.
2. **The "Try again" on a failed load doesn't say how long to wait.** Default: as built; "in a moment" is the only promise.

## Stage 3: design notes (2026-10-25)
- **Tokens are one file, `redesign/design/tokens.css`,** and the prototype uses nothing else. Checked: switching the prototype to it changed only what is listed here.
- **Three things changed on the way, all to make the system consistent:** the "need a look" button was 40px high and is now 44 (every control you press is at least 44); page titles on Categories and All transactions were 44px wide and are now 52 like the other two; the white used on petrol buttons is now a token.
- **One state was added to show a path that had no screen:** `review-incomplete` (a waiting line with no store name or no date).
- **The coverage tables are checked by the prototype's script** against the inventory, so a story or state can't go missing without it failing.
- **Nothing in the notes is new design.** Where a rule came from a decision, the notes point at `decisions.md`; the open questions there still have their defaults.
- **Not frozen.** The notes carry "draft for approval". Approving them freezes groups 4 and 5 as built too, which you haven't looked at yet.

