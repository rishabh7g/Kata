# Build a front desk that speaks the hotel's language (m04-e2)

- **Type:** construct
- **Concept:** Naming & Ubiquitous Language
- **Smell:** The construct temptation is to let implementation vocabulary write the code: dictionaries named dict, loop variables named item, booleans named flag, a helper named Manager — behavior a Test Suite accepts but no hotelier could read. The folder README carries the hotel glossary — guest, room, stay, check-in, check-out, occupied, vacant — and every class, method, and variable you add draws its words from it, each private member's responsibility fitting one sentence without 'and'.
- **Size budget:** ≤ 200 source LOC

## Goal

src/ holds the Target Interface and a stub only. Implement it until the Test Suite is green, keeping the design decisions named in the Smell hidden from callers.

## Run the Test Suite

```sh
cd tests
dotnet test
```

## The rules

- The Target Interface (`src/IFrontDesk.cs`) is **immutable during the
  Exercise**. Wanting to change it is a signal to record and discuss, not
  an allowed move.
- The Test Suite is generated from the brief's Target Interface, NEVER from the flawed code. Tests written from the flawed code would bless the Smell. Review the
  Test Suite before you start — it is the trustworthy artifact.
