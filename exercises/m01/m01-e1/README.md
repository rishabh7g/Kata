# Deepen a shallow document store (m01-e1)

- **Type:** refactor
- **Concept:** Deep Modules & Information Hiding
- **Smell:** Shallow module: the folder layout, file naming scheme, encoding, and save-before-load ordering all leak into every caller as parameters and rituals.
- **Size budget:** ≤ 250 source LOC

## Goal

The Smell is planted in `src/`. Refactor behind the Target Interface until every design decision the Smell leaks is hidden again — with the Test Suite green the whole time.

## Run the Test Suite

```sh
cd tests
dotnet test
```

## The rules

- The Target Interface (`src/IDocumentStore.cs`) is **immutable during the
  Exercise**. Wanting to change it is a signal to record and discuss, not
  an allowed move.
- The Test Suite is generated from the brief's Target Interface, NEVER from the flawed code. Tests written from the flawed code would bless the Smell. Review the
  Test Suite before you start — it is the trustworthy artifact.
