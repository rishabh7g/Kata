## Where the temptation is planted

`src/retrieval.py` compiles and both functions raise, but two module-level
names sit above them with comments that make leaking sound helpful:

- `SCORE_FLOOR = 0.2` — "drop anything below this, it is only noise". A
  `retrieve` that filters on it returns fewer chunks than it was asked for,
  and the caller has no way to tell an empty fetch from a store with nothing
  in it. That is the Module's first failure mode, retrieval miss, wired in as
  a default and hidden inside the function.
- `LAST_SCORES: list[float] = []` — "keep the last run's scores, they are
  handy for debugging". Module-level mutable state means two callers read
  each other's runs, and the same arguments stop giving the same answer.

Both are meant to be **deleted, not implemented**. A learner who keeps them
"because they were already there" has built the Smell.

## What the Test Suite pins down

Only the two signatures, written from the Target Interface alone:

- `chunk` — the exact boundaries of `chunk("abcdefghij", 4, 1)`, that
  consecutive pieces share exactly `overlap` characters of text (checked as
  shared text, not as an index), that a zero overlap puts the text back
  together verbatim, that a text shorter than one piece comes back whole,
  that an evenly divided text leaves no empty trailing piece, that empty text
  gives no pieces, and that a `size`/`overlap` pair which would never
  terminate raises `ValueError`.
- `retrieve` — the car question fetches the car chunk; a second question
  reorders the same four chunks; exactly `min(k, len(chunks))` chunks come
  back **including the ones that score 0.0** (the `SCORE_FLOOR` trap); equal
  scores keep their arrival order; `k = 0` and an empty store fetch nothing;
  a negative `k` raises `ValueError`; the same call twice gives the same
  answer and leaves the caller's list untouched (the `LAST_SCORES` trap).
- One test runs both together: cut the handbook, then fetch — the piece
  holding "hold the key down" is what comes back first.

The suite is deliberately silent on how the pieces are cut internally, how the
ranking is computed, and whether similarities are cached. Any implementation
that keeps the two functions pure and returns the documented counts passes.

## What a good solution hides

The scoring. Callers hand over a question, a list of chunks and a `k`, and get
chunks back — they never see a similarity, a threshold, or a vector. `embed`
and `cosine_similarity` are called inside `retrieve` and nowhere else, so
swapping the toy embedding for a real one is a change to one function.

A clean `retrieve` is three or four lines: embed the question, sort by
similarity descending (Python's `sorted` is stable, which is the whole
tie-break rule), slice to `k`. A clean `chunk` is a loop with a
`step = size - overlap` and one guard clause per way the arguments can be
nonsense.

## Reviewer notes

- Offline and deterministic by construction: no import beyond the standard
  library, no environment variable, no clock, no randomness. The vectors are
  `CAR (3, 0)`, `RECIPE (0, 5)`, `DELIVERY (2, 2)`, `LEAVE (0, 0)` against
  questions `(2, 0)` and `(0, 3)` — every expected ranking is arithmetic.
- `LEAVE` embeds to `(0, 0)`; the provided `cosine_similarity` scores a zero
  vector 0.0 against everything rather than dividing by zero, so the
  "returns exactly k" test cannot fail by accident.
- The skeleton is 89 lines (69 non-blank) and a reference solution lands near
  100, well inside the 150-line budget.
- CI does not run this suite. It collects it (`pytest --collect-only`), which
  is the Python analogue of `dotnet build` for the C# folders — Kata never
  gates on test execution (docs/engineering.md § 6), and a skeleton that is
  red by design could never pass such a gate.
