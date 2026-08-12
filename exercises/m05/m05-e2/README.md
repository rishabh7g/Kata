# Build a play queue with no errors left to handle (m05-e2)

- **Type:** construct
- **Concept:** Error Design
- **Smell:** The construct temptation is the standard library's own habit of throwing on the expected: Queue.Dequeue throws on empty, a Dictionary indexer throws on missing, and an implementer following those instincts turns every edge into an exception plus a catch block in some caller. This Target Interface has already defined those cases out of existence — playing from an empty queue returns silence, dropping a track that was never queued is a successful no-op, queuing a waiting track again moves it instead of failing. Implement it so that no input the Test Suite can produce ever reaches a throw: callers need zero catch blocks and know zero exception types.
- **Size budget:** ≤ 200 source LOC

## Goal

src/ holds the Target Interface and a stub only. Implement it until the Test Suite is green, keeping the design decisions named in the Smell hidden from callers.

## Run the Test Suite

```sh
cd tests
dotnet test
```

## The rules

- The Target Interface (`src/IPlayQueue.cs`) is **immutable during the
  Exercise**. Wanting to change it is a signal to record and discuss, not
  an allowed move.
- The Test Suite is generated from the brief's Target Interface, NEVER from the flawed code. Tests written from the flawed code would bless the Smell. Review the
  Test Suite before you start — it is the trustworthy artifact.
