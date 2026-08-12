namespace Kata.Exercise;

public class SeatMap : ISeatMap
{
    private const int ReservationLimit = 4;

    // seatId -> reserving customer, or null while the seat is free.
    private readonly Dictionary<string, string?> _seats = new();

    public void AddSeat(string seatId)
    {
        try
        {
            EnsureSeatUnknown(seatId);
            _seats[seatId] = null;
        }
        catch (DuplicateSeatException)
        {
            // Already on sale; adding again changes nothing.
        }
    }

    public bool Reserve(string seatId, string customerId)
    {
        try
        {
            EnsureSeatExists(seatId);
            EnsureSeatFree(seatId);
            EnsureUnderReservationLimit(customerId);
            _seats[seatId] = customerId;
            return true;
        }
        catch (UnknownSeatException)
        {
            return false;
        }
        catch (SeatAlreadyReservedException)
        {
            return false;
        }
        catch (ReservationLimitException)
        {
            return false;
        }
    }

    public bool Release(string seatId)
    {
        try
        {
            EnsureSeatExists(seatId);
            EnsureSeatReserved(seatId);
            _seats[seatId] = null;
            return true;
        }
        catch (UnknownSeatException)
        {
            return false;
        }
        catch (SeatNotReservedException)
        {
            return false;
        }
    }

    public int FreeSeatCount()
    {
        var free = 0;
        foreach (var seatId in _seats.Keys)
        {
            try
            {
                EnsureSeatFree(seatId);
                free++;
            }
            catch (SeatAlreadyReservedException)
            {
                // Reserved seats simply don't count.
            }
        }
        return free;
    }

    private void EnsureSeatUnknown(string seatId)
    {
        if (_seats.ContainsKey(seatId))
            throw new DuplicateSeatException(seatId);
    }

    private void EnsureSeatExists(string seatId)
    {
        if (!_seats.ContainsKey(seatId))
            throw new UnknownSeatException(seatId);
    }

    private void EnsureSeatFree(string seatId)
    {
        if (_seats[seatId] is not null)
            throw new SeatAlreadyReservedException(seatId);
    }

    private void EnsureSeatReserved(string seatId)
    {
        if (_seats[seatId] is null)
            throw new SeatNotReservedException(seatId);
    }

    private void EnsureUnderReservationLimit(string customerId)
    {
        var held = _seats.Values.Count(c => c == customerId);
        if (held >= ReservationLimit)
            throw new ReservationLimitException(customerId);
    }
}
