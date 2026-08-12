namespace Kata.Exercise;

// The internal catalog of everything that can go wrong inside the seat
// map. Callers of ISeatMap never see these — the public methods catch
// each one and translate it back into a return value.
public class SeatMapException : Exception
{
    public SeatMapException(string message) : base(message) { }
}

public class UnknownSeatException : SeatMapException
{
    public UnknownSeatException(string seatId)
        : base($"Seat '{seatId}' is not on sale.") { }
}

public class DuplicateSeatException : SeatMapException
{
    public DuplicateSeatException(string seatId)
        : base($"Seat '{seatId}' is already on sale.") { }
}

public class SeatAlreadyReservedException : SeatMapException
{
    public SeatAlreadyReservedException(string seatId)
        : base($"Seat '{seatId}' is already reserved.") { }
}

public class SeatNotReservedException : SeatMapException
{
    public SeatNotReservedException(string seatId)
        : base($"Seat '{seatId}' is not reserved.") { }
}

public class ReservationLimitException : SeatMapException
{
    public ReservationLimitException(string customerId)
        : base($"Customer '{customerId}' already holds the maximum number of reservations.") { }
}
