namespace Kata.Exercise;

public interface ISeatMap
{
    // Puts the seat on sale; call once per seat.
    void AddSeat(string seatId);

    // Reserves the seat for the customer. False — and nothing is
    // recorded — when the seat is unknown, already reserved, or the
    // customer already holds 4 reservations.
    bool Reserve(string seatId, string customerId);

    // Frees the seat. False when the seat is unknown or not
    // reserved.
    bool Release(string seatId);

    // Seats on sale and not reserved right now.
    int FreeSeatCount();
}
