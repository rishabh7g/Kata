# Fetch the chunk that answers the question (ai03-e1)

- **Type:** construct
- **Concept:** Retrieval-Augmented Generation
- **Smell:** The stub tempts two hidden decisions: a `SCORE_FLOOR` that silently drops weak chunks — a retrieval miss the caller cannot see — and a `LAST_SCORES` global that turns a pure fetch into shared state.
- **Size budget:** ≤ 150 source LOC

## Goal

`src/retrieval.py` holds the Target Interface and a stub only: `chunk` and
`retrieve` both raise. Implement them until the Test Suite is green.

This is the retrieval half of RAG — the two moves that happen before a model
is ever asked anything. No model is involved, and none is needed: `embed` and
`cosine_similarity` are provided above the stubs, and the embedding is the
Module's own two-number world (how much a text is about vehicles, how much
about food) counted from two fixed word lists. Every vector in the Test Suite
can be worked out with a pen.

**Nothing here goes near a network or an API key.** A real embedding model
reads meaning; this toy one counts words. That is the only difference that
matters for the design question in front of you.

## Run the Test Suite

```sh
pip install pytest
pytest
```

Run it from this folder. `tests/conftest.py` puts `src/` on the import path,
so there is nothing to install but pytest itself and nothing to configure.

## The rules

- The Target Interface (the `chunk` and `retrieve` signatures in
  `src/retrieval.py`) is **immutable during the Exercise**. Wanting to change
  it is a signal to record and discuss, not an allowed move.
- `embed` and `cosine_similarity` are **provided**. They are not part of the
  Exercise: changing them changes the answers the Test Suite was written
  against.
- The Test Suite is generated from the brief's Target Interface, NEVER from the flawed code. Tests written from the flawed code would bless the Smell. Review the
  Test Suite before you start — it is the trustworthy artifact.
