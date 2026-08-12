# Build a currency quoter that owns its arrows (m02-e2)

- **Type:** construct
- **Concept:** Dependency Direction
- **Smell:** The stub tempts the naive arrow: quoting policy that reaches out to a concrete rates source — a hard-coded table, a static cache, an HTTP client — from inside the calculation. The rates source is the volatile detail; the policy must own the abstraction (IExchangeRates) and receive the implementation through its constructor.
- **Size budget:** ≤ 200 source LOC

## Goal

src/ holds the Target Interface and a stub only. Implement it until the Test Suite is green, keeping the design decisions named in the Smell hidden from callers.

## Run the Test Suite

```sh
cd tests
dotnet test
```

## The rules

- The Target Interface (`src/IExchangeRates.cs`) is **immutable during the
  Exercise**. Wanting to change it is a signal to record and discuss, not
  an allowed move.
- The Test Suite is generated from the brief's Target Interface, NEVER from the flawed code. Tests written from the flawed code would bless the Smell. Review the
  Test Suite before you start — it is the trustworthy artifact.
