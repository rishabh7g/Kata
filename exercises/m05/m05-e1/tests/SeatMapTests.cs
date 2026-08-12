using Kata.Exercise;
using Xunit;

namespace Kata.Exercise.Tests;

public class SeatMapTests
{
    private static ISeatMap NewSeatMap() => new SeatMap();

    private static ISeatMap MapWithSeats(params string[] seatIds)
    {
        var map = NewSeatMap();
        foreach (var seatId in seatIds)
            map.AddSeat(seatId);
        return map;
    }

    [Fact]
    public void FreeSeatCount_IsZeroBeforeAnySeatIsOnSale()
    {
        Assert.Equal(0, NewSeatMap().FreeSeatCount());
    }

    [Fact]
    public void AddSeat_PutsSeatsOnSaleAsFree()
    {
        var map = MapWithSeats("A1", "A2", "A3");
        Assert.Equal(3, map.FreeSeatCount());
    }

    [Fact]
    public void Reserve_FreeSeat_SucceedsAndSeatIsNoLongerFree()
    {
        var map = MapWithSeats("A1", "A2");
        Assert.True(map.Reserve("A1", "alice"));
        Assert.Equal(1, map.FreeSeatCount());
    }

    [Fact]
    public void Reserve_UnknownSeat_FailsAndRecordsNothing()
    {
        var map = MapWithSeats("A1");
        Assert.False(map.Reserve("Z9", "alice"));
        Assert.Equal(1, map.FreeSeatCount());
    }

    [Theory]
    [InlineData("alice")]
    [InlineData("bob")]
    public void Reserve_AlreadyReservedSeat_FailsForAnyCustomer(string secondCustomer)
    {
        var map = MapWithSeats("A1");
        Assert.True(map.Reserve("A1", "alice"));
        Assert.False(map.Reserve("A1", secondCustomer));
        Assert.Equal(0, map.FreeSeatCount());
    }

    [Fact]
    public void Reserve_FailedAttemptDoesNotCountTowardTheCustomersLimit()
    {
        var map = MapWithSeats("A1", "B1", "B2", "B3", "B4");
        Assert.True(map.Reserve("A1", "alice"));
        Assert.False(map.Reserve("A1", "bob"));
        Assert.True(map.Reserve("B1", "bob"));
        Assert.True(map.Reserve("B2", "bob"));
        Assert.True(map.Reserve("B3", "bob"));
        Assert.True(map.Reserve("B4", "bob"));
    }

    [Fact]
    public void Reserve_FifthSeatForSameCustomer_FailsAndSeatStaysFree()
    {
        var map = MapWithSeats("A1", "A2", "A3", "A4", "A5");
        Assert.True(map.Reserve("A1", "alice"));
        Assert.True(map.Reserve("A2", "alice"));
        Assert.True(map.Reserve("A3", "alice"));
        Assert.True(map.Reserve("A4", "alice"));
        Assert.False(map.Reserve("A5", "alice"));
        Assert.Equal(1, map.FreeSeatCount());
        Assert.True(map.Reserve("A5", "bob"));
    }

    [Fact]
    public void Release_ReservedSeat_SucceedsAndSeatCanBeReservedAgain()
    {
        var map = MapWithSeats("A1");
        Assert.True(map.Reserve("A1", "alice"));
        Assert.True(map.Release("A1"));
        Assert.Equal(1, map.FreeSeatCount());
        Assert.True(map.Reserve("A1", "bob"));
    }

    [Fact]
    public void Release_UnknownSeat_Fails()
    {
        var map = MapWithSeats("A1");
        Assert.False(map.Release("Z9"));
        Assert.Equal(1, map.FreeSeatCount());
    }

    [Fact]
    public void Release_SeatThatIsNotReserved_Fails()
    {
        var map = MapWithSeats("A1");
        Assert.False(map.Release("A1"));
        Assert.Equal(1, map.FreeSeatCount());
    }

    [Fact]
    public void Release_FreesTheCustomersLimitSlot()
    {
        var map = MapWithSeats("A1", "A2", "A3", "A4", "A5");
        Assert.True(map.Reserve("A1", "alice"));
        Assert.True(map.Reserve("A2", "alice"));
        Assert.True(map.Reserve("A3", "alice"));
        Assert.True(map.Reserve("A4", "alice"));
        Assert.True(map.Release("A1"));
        Assert.True(map.Reserve("A5", "alice"));
    }
}
