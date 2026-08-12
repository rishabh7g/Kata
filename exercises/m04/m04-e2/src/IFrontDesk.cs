namespace Kata.Exercise;

public interface IFrontDesk
{
    // Opens the room for guests; call once per room.
    void AddRoom(string roomNumber);

    // Checks the guest in. False — and nothing is recorded — when
    // the room is unknown or occupied, or the guest is already
    // checked in anywhere in the hotel.
    bool CheckIn(string guestName, string roomNumber);

    // Checks out whoever occupies the room. False when the room is
    // unknown or vacant.
    bool CheckOut(string roomNumber);

    // True while a guest occupies the room. Unknown room: false.
    bool IsOccupied(string roomNumber);
}
