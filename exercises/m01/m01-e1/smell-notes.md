## Where the Smell is planted

`FileCabinet` is the shallow module: six public static methods, each a one-or-two-line wrapper over `System.IO`, whose signatures re-expose every decision as a parameter — root folder, shelf, cleaned name, `.doc.txt` extension, `"utf-8"` encoding name, `index.txt` file name. Nothing is hidden, so every caller carries the full ritual:

- `DocumentStore.Save/Load/Exists` each repeat the clean-name → derive-shelf → magic-strings sequence, and `Save` must append an index line after writing the payload or `Load` refuses the document (the save-before-load ordering).
- `StoreStatistics.CountSavedDocuments` is a second caller class that spells the same ritual out again — the knowledge is duplicated, not encapsulated.
- `NameRules` and `EncodingPicker` are further shallow slices: near-pass-through helpers whose existence forces callers to know when (and in what order) to call them.

## What the Test Suite pins down

Written from the Target Interface alone: save/load round-trip (including empty, multi-line, and non-ASCII contents), overwrite returns the latest contents, `Exists` before/after save, `Load` of a never-saved document throws (`Assert.ThrowsAny<Exception>`, so no specific exception type from the flawed code gets blessed), documents with different names are independent, and documents survive a new store instance on the same root folder. No test mentions shelves, extensions, encodings, or the index — any deepened implementation passes unchanged.

## What a good solution hides

Everything behind `IDocumentStore`: folder layout, naming scheme, encoding choice, and the index. `FileCabinet`, `NameRules`, `EncodingPicker`, and `StoreStatistics` collapse into `DocumentStore` (or private helpers); the index file likely disappears entirely, since `File.Exists` already answers both `Exists` and the missing-document guard in `Load`. The constructor keeps taking just the root folder — the one decision a caller legitimately owns.

## Reviewer notes

- The tests name the concrete type on exactly one line (the `CreateStore` factory) — unavoidable to obtain an instance; every assertion sees only the Target Interface.
- The persistence-across-instances test deliberately pins that this is a *document store* (disk-backed), ruling out an in-memory-dictionary "solution".
- src totals ≈160 non-blank lines, within the 250-line budget.
