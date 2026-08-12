# Take the exceptions out of a seat map's everyday flow (m05-e1)

- **Type:** refactor
- **Concept:** Error Design
- **Smell:** Exceptions used for expected control flow: the cinema seat map answers correctly and the boundary Test Suite starts green, but behind the Target Interface every expected outcome — unknown seat, seat already reserved, customer at the reservation limit — is raised as a custom exception by private helpers and caught again by the public methods, which translate each one back into false. The happy path runs on catch blocks, the same try/catch handling is duplicated in every method, and the internal exception catalog exists only to be swallowed. Refactor behind the Target Interface until the expected cases are ordinary conditionals and throw/catch disappear from src/, Test Suite green after every step.
- **Size budget:** ≤ 250 source LOC

## Goal

The Smell is planted in `src/`. Refactor behind the Target Interface until every design decision the Smell leaks is hidden again — with the Test Suite green the whole time.

## Run the Test Suite

```sh
cd tests
dotnet test
```

## The rules

- The Target Interface (`src/ISeatMap.cs`) is **immutable during the
  Exercise**. Wanting to change it is a signal to record and discuss, not
  an allowed move.
- The Test Suite is generated from the brief's Target Interface, NEVER from the flawed code. Tests written from the flawed code would bless the Smell. Review the
  Test Suite before you start — it is the trustworthy artifact.
