## Where the temptation is planted

The stub compiles and every member throws, but three members sit outside the Target Interface, each with a doc comment that makes leaking sound helpful:

- `Capacity` (get/set) — invites callers to size the cache for their workload.
- `EvictionOrder` — invites callers to watch and reason about eviction.
- `PurgeExpired()` — invites callers to schedule the expiry bookkeeping themselves.

Implementing any of them produces a shallow module: the two-method surface grows to five, and every caller inherits three decisions the cache should own. A learner who keeps them "because they were already there" has built the Smell — that is the trap.

## What the Test Suite pins down

Only the two-method contract, written from the Target Interface alone (the concrete class is named in exactly one factory line):

- Miss → `false` with `value` left at default, for both reference and value types.
- `Put` then `TryGet` round-trips, including overwrite and the empty-string key.
- Reads are repeatable — `TryGet` does not consume the entry.
- The most recently `Put` entry is always retrievable, even after 10,000 puts (so eviction may never claim the newest entry).
- A key never put stays missing no matter how full the cache gets (no phantom entries).

The suite is deliberately silent on the capacity number, which entry gets evicted, and when expiry runs. Any hidden policy — LRU, FIFO, lazy expiry on access, no expiry at all — passes. That freedom is the point: the tests define the boundary, not the internals.

## What a good solution hides

Capacity is chosen once, privately. The eviction policy lives in a private structure (e.g. dictionary + linked list for LRU, or an insertion-ordered queue). Expiry, if implemented at all, is bookkept lazily inside `Put`/`TryGet` — no caller-visible purge step. The three tempting members are deleted, not implemented: the finished class's public surface is exactly `Put` and `TryGet`.
