## Where the Smell is planted

- `RentalLedger` — the late-fee policy — constructs its own `CsvFileStore` with `new` in its constructor: the business rules choose and own the storage detail.
- `LateFeeFor` pulls the store's `FilePath` out and threads it through the policy: `FindLatestCsvLine(string csvFilePath, ...)` calls `File.ReadAllLines` itself, so the fee rules read straight from disk.
- `FeeFromCsvLines(string checkoutCsvLine, string returnCsvLine)` — the core fee arithmetic — takes raw CSV fragments and does `Split(',')[2]` + `long.Parse` inline. Reordering CSV columns or changing the timestamp format means editing the fee math.
- Even the error messages leak the detail ("no CHECKOUT row in <file path>").
- `OverdueReport` is a second policy-side caller pointed at the same detail: it takes the CSV path itself, re-reads the file, and re-parses `CHECKOUT`/`RETURN` rows with its own `Split(',')` — the row format now lives in two places, so one storage change ripples into two classes.
- Collateral pain worth showing the learner: every test run writes real temp files, because the policy cannot exist without a file on disk.

## What the Test Suite pins down

Written from the Target Interface alone; the single concrete touch point is the `CreateLedger()` factory line (the only line a learner would adjust if they rename the entry class).

- 0m at or before the due moment — the "exactly at the due moment is free" boundary.
- 2.50m per **started** 24h period: 1 minute late = 2.50, exactly 24h late = still 2.50, 24h + 1 minute = 5.00.
- The 50m cap, reached exactly at 20 periods and held far beyond.
- Throws for a never-checked-out id and for a checked-out-but-unreturned id (`ThrowsAny<Exception>` — the interface doesn't promise an exception type, so the tests don't invent one).
- Distinct rentalIds in one ledger accrue independent fees.

## What a good solution hides

The arrows reverse: the policy declares the abstraction it needs — a rental-events store spoken in domain terms (rental ids and `DateTime`s; no file paths, no CSV lines) — and the CSV store becomes one implementation that depends on *that*. The fee math then compares `DateTime`s/`TimeSpan`s instead of parsing `Split(',')[2]`, the storage format becomes swappable without touching a fee rule, and the Test Suite can run against an in-memory store with zero disk I/O. `OverdueReport` stops parsing CSV too: it asks the same abstraction for events, and the row format lives in exactly one class — the store implementation.
