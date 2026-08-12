# Reverse the arrows in a rental late-fee ledger (m02-e1)

- **Type:** refactor
- **Concept:** Dependency Direction
- **Smell:** Dependency direction: the late-fee policy — the business rules — points its arrows at a concrete detail. It constructs its own CSV file store with new, parses raw CSV lines inside the fee rules, and helper signatures pass file paths and CSV fragments through the business logic, so changing the storage format means editing the policy.
- **Size budget:** ≤ 250 source LOC

## Goal

The Smell is planted in `src/`. Refactor behind the Target Interface until every design decision the Smell leaks is hidden again — with the Test Suite green the whole time.

## Run the Test Suite

```sh
cd tests
dotnet test
```

## The rules

- The Target Interface (`src/IRentalLedger.cs`) is **immutable during the
  Exercise**. Wanting to change it is a signal to record and discuss, not
  an allowed move.
- The Test Suite is generated from the brief's Target Interface, NEVER from the flawed code. Tests written from the flawed code would bless the Smell. Review the
  Test Suite before you start — it is the trustworthy artifact.
