# Needs inventory

What the app has to let its one user do, written as job stories. It says nothing about how anything looks or where it sits. Stories are grouped by job; IDs are for reference only and don't imply an order.

The user is one person tracking their own spending from a BCA (Indonesian bank) account. Most spending arrives as banking-app screenshots; the rest is typed in by hand.

## Capture

- **C1** When I've paid for several things from my bank account, I want to bring in one or more banking-app screenshots at once and have the transactions extracted for me, so that I don't type each one.
- **C2** When I paid in cash, or a spend isn't in any screenshot, I want to record it by hand with its date (today unless I change it), store, amount, category and an optional note, so that my record is complete.
- **C3** When screenshots are being read, I want to know the import is still working, so that I don't leave or send the same screenshots again.
- **C4** When a screenshot can't be read, or holds no transactions, I want to be told so, so that I can retake it or type those spends in myself.

## Review

- **R1** When transactions have been extracted from a screenshot, I want to check each one before it counts toward any total, so that a misread amount, date or name never reaches my record.
- **R2** When an extracted transaction is wrong, I want to correct its date, store, amount, category or note, so that it's correct before I accept it.
- **R3** When an extracted transaction is correct, I want to accept it with a single action, so that getting through a batch is quick.
- **R4** When something extracted isn't a real spend (a duplicate, an incoming transfer, a misread line), I want to throw it away before it counts, so that my totals stay honest.
- **R5** When I come back later, I want transactions I haven't checked yet to still be waiting, and to know how many there are, so that I can finish reviewing in my own time.
- **R6** When I've corrected part of an extracted transaction and get interrupted, I want my corrections kept, so that I don't redo them.

## Understand

- **U1** When I want to know where I stand, I want the total I've spent in the current month or week, so that I can judge whether to slow down.
- **U2** When I see a period's total, I want it compared with the period before (how much higher or lower, and what the earlier total was), so that I know whether I'm spending more or less than usual.
- **U3** When I want to know where the money went, I want the period's spending split by category, each with its amount, biggest first, and each category recognisable by its emoji and colour, so that the heaviest areas stand out.
- **U4** When I want to know when I spent, I want spending shown day by day across the period, with the exact amount for any single day, so that I notice spikes.
- **U5** When I want to know what hit hardest, I want the period's biggest spends, each with its date, store and category, so that I remember the large purchases.
- **U6** When I want to look back, I want to move to any earlier (or later) week or month, and switch between week and month while staying around the same date, so that I can compare past periods.

## Find & fix

- **F1** When I'm looking for one transaction, I want to search words in the store or note, so that I find it fast.
- **F2** When I want only some transactions, I want to narrow them by date (any single day, week or month, a custom start and end date, or all time), by one or more categories, by an amount range, and by source (typed in by hand or imported from a screenshot), so that I see only what matters.
- **F3** When I've narrowed things down, I want to know how many filters are on and clear them all at once, so that I don't forget something is hidden.
- **F4** When going through transactions, I want them ordered by date (newest or oldest first) or by amount (highest or lowest first), so that the ones I care about come first.
- **F5** When I glance at a transaction, I want its date, store, amount, category (emoji and name), note, and whether it was imported from a screenshot, so that I recognise it without opening it.
- **F6** When a saved transaction is wrong, imported or not, I want to change its date, store, amount, category or note, so that my totals are accurate.
- **F7** When a transaction shouldn't exist, I want to delete it for good after confirming once, so that I never delete one by accident.

## Organise

- **O1** When I first start, I want a ready-made set of categories, so that I can begin without setting anything up. The starter set, in no particular order: Business 💼, Church & Giving ⛪, Education 🎓, Entertainment 🎮, Food & Drink 🍽️, Groceries 🛒, Health 💊, Home & Utilities 🏠, Investments 📈, Relationship 💑, Shopping 👗, Subscriptions 🔧, Telecommunications 📶, Transport 🚗, Travel ✈️, Other ❓.
- **O2** When my spending doesn't fit any category, I want to add one with a name, an emoji and a colour, so that it's tracked separately.
- **O3** When a category's name, emoji or colour no longer suits it, I want to change it, and have the change show everywhere, so that old transactions follow along.
- **O4** When some categories matter more than others, I want to set their order, so that the ones I use most come first whenever I pick a category.
- **O5** When tidying categories, I want to see how many transactions each one has, so that I know which are used.
- **O6** When I no longer need a category, I want to delete it after confirming; if it still has transactions, I must first choose another category to move them all into, so that every transaction always has a category.

## States

Every one of these needs a designed moment:

- **Nothing yet:** no transactions at all (first use); a period with no spending; nothing waiting for review.
- **Starter categories being set up** on the very first open.
- **Loading** transactions or categories.
- **Failed to load** transactions or categories.
- **No connection:** the installed app opens without internet; data can't load, save or import.
- **No results:** a search or set of filters matches nothing.
- **No earlier spending to compare with:** the period before had nothing.
- **Import in progress,** possibly several screenshots in one go.
- **Import failed** for a screenshot, or **found nothing** in it.
- **Waiting for review:** some extracted transactions not yet checked, with their count.
- **Not ready to save:** a transaction missing its amount (must be above zero), store, category or date; a category missing its name.
- **Saving or deleting in progress.**
- **Checking a category before deleting it,** then either "no transactions, delete it" or "has transactions, choose where they go".
- **Missing category:** a transaction whose category can't be found.
- **A day with no spending** inside an otherwise busy period.

## Hard constraints

- **Phone first.** Used mostly on a phone, often to check imported transactions; must also work well on a desktop browser.
- **Installable.** Can be installed on the phone and opened like any other app, without a browser around it.
- **IDR amounts.** Whole rupiah, written `Rp 1.234.567` (dots between thousands). Single spends range from a few thousand to tens of millions of rupiah.
- **Indonesian bank screenshots.** Imports are screenshots from the BCA banking app, several at a time.
- **One user.** No sign-in, no sharing, no other people's data.
- **Calendar.** Dates are local calendar days; weeks run Monday to Sunday.
- **Categories carry an emoji and a colour,** both chosen by the user.
