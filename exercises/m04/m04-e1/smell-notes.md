# Smell notes — m04-e1 (for the reviewer)

## Where the Smell is planted

The desk behaves correctly; only the language is wrong. Every name behind `ILendingDesk` is off-domain, inconsistent, or dishonest:

- **Borrowed vocabulary** — `DeskManager`, `RecordProcessor`, `ItemData`, `UserRecord`, `Util`, `_itemMap`, `_tempList`, locals `temp` / `data` / `flag`, fields `Num` / `Stuff` / `MAX`.
- **One concept, many names** — the title is `title` / `key` / `item` / `entry` / `Name` depending on the corner; the member is `memberId` / `userId` / `uid`; a loan is just an element of `Stuff`.
- **Names that lie about scope** —
  - `DeskManager.GetItem` and `RecordProcessor.GetRecord` are Gets that *create* the thing when it is missing.
  - `RecordProcessor.CheckUser` is a Check that *mutates*: when the member is eligible it also records the loan. (Renaming it truthfully is the heart of the exercise — a careless rename that drops the write goes red immediately.)
  - `RecordProcessor.ProcessItem` says nothing; it is the return-a-loan operation.
- The comments repeat the lies ("Checks whether the user can take the item") — they need renaming too.

## Glossary — the library's language (target vocabulary)

| Concept | Library term | Currently called |
|---|---|---|
| The service behind the boundary | Lending desk | `DeskManager` |
| A work the library lends | Title | `key`, `item`, `entry`, `Name` |
| Physical copies on the shelf | Copies on shelf | `Num` |
| The shelf of all titles | Shelf | `_itemMap` |
| A person who borrows | Member | `userId`, `uid`, `rec` |
| One title a member holds | Loan | element of `Stuff` |
| All of one member's loans | Member's loans | `UserRecord` / `Stuff` |
| Most loans a member may hold | Loan limit (3) | `Util.MAX` |
| Lending a copy to a member | Check out | `CheckUser` |
| Taking a copy back | Return | `ProcessItem` |

Suggested honest shapes (not the only right answer): `LendingDesk`, `LoanLedger` or `MemberLoans`, `ShelfEntry { Title, CopiesOnShelf }`, `_shelf`, `LoanLimit`, `TryRecordLoan(memberId, title)` — a name that admits the write — `TryReturnLoan(...)`, and `GetOrAddEntry` (or a split create/read) instead of a lying `Get`.

## What the Test Suite pins down

Written purely from `ILendingDesk`, the tests pin the whole observable contract: per-title shelf counting, unknown titles reading 0, all three `CheckOut` refusal reasons (no copy, 3-loan limit, duplicate title), that failed check-outs record nothing, the `Return` rules (no loan held, double return, wrong member), and that a return frees both the copy and a loan slot. With the boundary fully pinned, every rename is safe exactly when the suite stays green — and any "rename" that accidentally changes behavior (e.g. losing the write inside `CheckUser`) fails fast.

## What a good solution looks like

- Internals read in the same language as the interface comments: shelf, copy, title, member, loan, loan limit.
- Exactly one name per concept, used everywhere — no `item`-here-`entry`-there.
- No name lies about scope: `Get` doesn't create, `Check` doesn't write; anything that mutates carries a verb that says so. Splitting `CheckUser` into an eligibility query plus an explicit record-the-loan step is a natural bonus move, but a single truthful name also passes.
- Zero behavior change: `dotnet test` green after every individual rename.
