# Grow a rate limiter red-to-green behind a fake clock (m03-e2)

- **Type:** construct
- **Concept:** Testing at Boundaries + TDD loop
- **Smell:** The construct temptation is to skip the loop and the boundary at once: implement everything in one sitting against the real clock — DateTime.UtcNow read inside the policy — leaving the sliding window testable only by actually waiting it out. Time is the volatile dependency: the limiter receives IClock through its constructor, the Test Suite drives a fake clock, and you work one red test at a time, top to bottom.
- **Size budget:** ≤ 200 source LOC

## Goal

src/ holds the Target Interface and a stub only. Implement it until the Test Suite is green, keeping the design decisions named in the Smell hidden from callers.

## Run the Test Suite

```sh
cd tests
dotnet test
```

## The rules

- The Target Interface (`src/IClock.cs`) is **immutable during the
  Exercise**. Wanting to change it is a signal to record and discuss, not
  an allowed move.
- The Test Suite is generated from the brief's Target Interface, NEVER from the flawed code. Tests written from the flawed code would bless the Smell. Review the
  Test Suite before you start — it is the trustworthy artifact.
