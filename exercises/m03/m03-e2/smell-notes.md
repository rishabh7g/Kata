## Smell notes — m03-e2 (construct)

**The temptation.** Nothing stops the learner from reading `DateTime.UtcNow` inside `TryPass` and writing the whole limiter in one sitting. The stub's constructor already takes `IClock`, so the honest path is laid out — the Smell is skipping it: ignore the injected clock, implement everything at once, and discover the sliding window can only be exercised by actually waiting 60 seconds. The Test Suite makes that path fail fast: every test manipulates a `FakeClock`, so an implementation wired to the real clock passes the first three tests and then fails every time-dependent one instantly (no test sleeps).

**TDD ordering.** Tests are deliberately sequenced simple → subtle so the loop is one red test at a time: first call → five pass → sixth refused → the 60s boundary (exactly 60s still counts; strictly more than 60s ages out) → the window actually slides (staggered timestamps age out individually, killing fixed-bucket implementations) → refusals leave no trace → keys are independent. Each test forces one increment of design: a counter, then timestamps, then per-timestamp pruning, then per-key state.

**What the suite pins down.**
- The boundary is *more than* 60 seconds — `>` on age, not `>=`. `CallExactlySixtySecondsOldStillCounts` vs `CallAgesOutOnceMoreThanSixtySecondsOld` pin both sides.
- Sliding, not fixed windows: `WindowSlidesCallsAgeOutIndividually` fails a bucket-reset implementation.
- Refused calls are not recorded: refusals are made at a *different* time (t=30) than the recorded calls (t=0), so recording refusals is observably wrong at t=61 — a subtle trap an easier test (refusals at t=0) would miss.
- Per-key isolation.

**What a good solution hides.** Behind `IRateLimiter`: the storage shape (queue of timestamps per key), the pruning strategy, and the single read of `_clock.UtcNow` per call. The clock is the only boundary crossing; the tests never mention real time, and `dotnet test` finishes in milliseconds despite exercising a 60-second window.
