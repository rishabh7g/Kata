## Where the Smell is planted

- `SeatMapExceptions.cs` is a six-class internal exception catalog (`UnknownSeatException`, `SeatAlreadyReservedException`, `ReservationLimitException`, …) that exists only to be swallowed: no exception ever escapes the public surface.
- Every private `Ensure*` helper in `SeatMap.cs` reports an *expected* outcome — unknown seat, seat taken, customer at the limit — by throwing; every public method wraps its body in `try/catch` and translates each exception back into `false` (or, in `AddSeat`, into a silent no-op). The same catch-and-return-false blocks are duplicated across `Reserve` and `Release`.
- `FreeSeatCount` is the everyday flow running on catch blocks: it counts free seats by calling `EnsureSeatFree` per seat and catching `SeatAlreadyReservedException` for every reserved one — a pure query implemented with control-flow exceptions.

## What the Test Suite pins down

Written from the Target Interface only; it never mentions exceptions, so it stays green through the whole refactor.

- All outcomes are booleans and counts: reserve/release success, `false` for unknown / already-reserved / at-limit / not-reserved.
- "Nothing is recorded" on failure: a failed `Reserve` leaves the seat free and does not consume the failing customer's limit slot.
- The limit is 4 *currently held* reservations per customer: a fifth reserve fails, another customer can still take the seat, and `Release` frees a slot so the customer can reserve again.
- Released seats return to the free count and can be re-reserved by anyone.

## What a good solution looks like

Expected cases become ordinary conditionals behind the unchanged Target Interface: `TryGetValue` / `ContainsKey` for unknown seats, a null check for reserved-vs-free, a count comparison for the limit — each method a short guard-and-return with no `try`, no `catch`, no `throw` anywhere in `src/`. The entire `SeatMapExceptions.cs` file gets deleted; nothing replaces it. If the learner keeps any exception, it should only be for a genuinely *unexpected* condition (a programming error), not for any outcome the interface already expresses as `false`. Behavior is byte-for-byte identical, so the suite stays green after every small step.
