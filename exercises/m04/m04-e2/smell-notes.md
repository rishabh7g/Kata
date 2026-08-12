## Smell notes — m04-e2 (construct: Naming & Ubiquitous Language)

**Where the Smell lives.** This is a construct Exercise, so no flaw is planted — the stub (`FrontDesk.cs`) only throws `NotImplementedException`. The temptation is in what the learner must add: the *guest is already checked in anywhere in the hotel* rule forces a second lookup (guest → current stay) beside the obvious room lookup. That pressure is exactly where implementation vocabulary creeps in — `dict`/`dict2`, `flag`, `found`, `item`, or a `StayManager`/`Helper` class. The Test Suite makes the rule unavoidable; the glossary in the folder README (guest, room, stay, check-in, check-out, occupied, vacant) supplies the words a good solution uses instead.

**What the Test Suite pins down** (written from the Target Interface only):
- A newly added room and an unknown room both read as not occupied.
- Check-in succeeds only into a known, vacant room, by a guest with no current stay.
- Refused check-ins record *nothing*: the turned-away guest can still check in elsewhere, and the room they were refused stays vacant.
- One stay per guest: a checked-in guest cannot start a second stay in another room.
- Check-out succeeds exactly once per stay, refuses unknown and vacant rooms, and frees the room for a new guest — and frees the guest for a new stay.
- Rooms are independent: checking one guest out leaves the other room occupied.

**What a good solution hides.** Behind `IFrontDesk`, something like a private `Room` holding its current occupant, or two maps named in hotel language (`staysByRoomNumber`, `occupiedRoomByGuest`) — every identifier drawn from the glossary, each private member's responsibility stating one sentence without 'and'. The compound `CheckIn` guard reads as domain prose (`room is null || room.IsOccupied || HasCurrentStay(guestName)`), not as flag arithmetic.

**Deliberately untested / unspecified.** Duplicate `AddRoom` (the Target Interface says "call once per room", so behavior is the implementer's choice) and case-sensitivity of guest names and room numbers. Reviewers should not add tests for these — they would over-constrain the Exercise beyond the brief.
