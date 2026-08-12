# Shrink a basket pricer's test-widened surface (m03-e1)

- **Type:** refactor
- **Concept:** Testing at Boundaries + TDD loop
- **Smell:** Testing through the internals: the basket pricer was made "testable" by widening its surface. Public step methods the old tests drove in sequence, public fields exposing intermediate pipeline state, and a public discount audit log exist only so tests could watch the pipeline run — renaming one step broke tests while every price stayed identical. All the behavior is observable at the Target Interface; hide the steps and the state again, with the boundary Test Suite green the whole time.
- **Size budget:** ≤ 250 source LOC

## Goal

The Smell is planted in `src/`. Refactor behind the Target Interface until every design decision the Smell leaks is hidden again — with the Test Suite green the whole time.

## Run the Test Suite

```sh
cd tests
dotnet test
```

## The rules

- The Target Interface (`src/IBasketPricer.cs`) is **immutable during the
  Exercise**. Wanting to change it is a signal to record and discuss, not
  an allowed move.
- The Test Suite is generated from the brief's Target Interface, NEVER from the flawed code. Tests written from the flawed code would bless the Smell. Review the
  Test Suite before you start — it is the trustworthy artifact.
