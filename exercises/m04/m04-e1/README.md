# Rename a lending desk into the library's language (m04-e1)

- **Type:** refactor
- **Concept:** Naming & Ubiquitous Language
- **Smell:** Off-domain and dishonest names: the lending desk behaves correctly and the boundary Test Suite starts green, but nothing behind the Target Interface speaks the library's language. The internals are written in borrowed vocabulary — Manager, Process, Data, item, temp, flag — the same domain concept goes by several names in different corners, and several names lie about scope: a Get that creates, a Check that mutates. Rename everything behind the Target Interface into the library's own terms (the glossary in smell-notes.md), Test Suite green after every rename.
- **Size budget:** ≤ 250 source LOC

## Goal

The Smell is planted in `src/`. Refactor behind the Target Interface until every design decision the Smell leaks is hidden again — with the Test Suite green the whole time.

## Run the Test Suite

```sh
cd tests
dotnet test
```

## The rules

- The Target Interface (`src/ILendingDesk.cs`) is **immutable during the
  Exercise**. Wanting to change it is a signal to record and discuss, not
  an allowed move.
- The Test Suite is generated from the brief's Target Interface, NEVER from the flawed code. Tests written from the flawed code would bless the Smell. Review the
  Test Suite before you start — it is the trustworthy artifact.
