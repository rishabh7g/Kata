# Build a recent-values cache behind a two-method surface (m01-e2)

- **Type:** construct
- **Concept:** Deep Modules & Information Hiding
- **Smell:** The stub tempts a shallow build: exposing capacity, eviction order, and expiry bookkeeping to callers. All three are design decisions the cache must own and hide.
- **Size budget:** ≤ 200 source LOC

## Goal

src/ holds the Target Interface and a stub only. Implement it until the Test Suite is green, keeping the design decisions named in the Smell hidden from callers.

## Run the Test Suite

```sh
cd tests
dotnet test
```

## The rules

- The Target Interface (`src/IRecentValues.cs`) is **immutable during the
  Exercise**. Wanting to change it is a signal to record and discuss, not
  an allowed move.
- The Test Suite is generated from the brief's Target Interface, NEVER from the flawed code. Tests written from the flawed code would bless the Smell. Review the
  Test Suite before you start — it is the trustworthy artifact.
