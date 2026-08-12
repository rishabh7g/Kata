using Kata.Exercise;
using Xunit;

namespace Kata.Exercise.Tests;

public class FrontDeskTests
{
    private static IFrontDesk HotelWithRooms(params string[] roomNumbers)
    {
        IFrontDesk frontDesk = new FrontDesk();
        foreach (var roomNumber in roomNumbers)
        {
            frontDesk.AddRoom(roomNumber);
        }
        return frontDesk;
    }

    [Fact]
    public void NewlyAddedRoomIsVacant()
    {
        var frontDesk = HotelWithRooms("101");

        Assert.False(frontDesk.IsOccupied("101"));
    }

    [Fact]
    public void UnknownRoomIsNeverOccupied()
    {
        var frontDesk = HotelWithRooms("101");

        Assert.False(frontDesk.IsOccupied("999"));
    }

    [Fact]
    public void GuestChecksInToAVacantRoom()
    {
        var frontDesk = HotelWithRooms("101");

        Assert.True(frontDesk.CheckIn("Ada", "101"));
        Assert.True(frontDesk.IsOccupied("101"));
    }

    [Fact]
    public void CheckInToAnUnknownRoomIsRefused()
    {
        var frontDesk = HotelWithRooms("101");

        Assert.False(frontDesk.CheckIn("Ada", "999"));
        Assert.False(frontDesk.IsOccupied("999"));
    }

    [Fact]
    public void CheckInToAnOccupiedRoomIsRefused()
    {
        var frontDesk = HotelWithRooms("101");
        frontDesk.CheckIn("Ada", "101");

        Assert.False(frontDesk.CheckIn("Bob", "101"));
        Assert.True(frontDesk.IsOccupied("101"));
    }

    [Fact]
    public void RefusedCheckInRecordsNothingForTheTurnedAwayGuest()
    {
        var frontDesk = HotelWithRooms("101", "102");
        frontDesk.CheckIn("Ada", "101");
        frontDesk.CheckIn("Bob", "101");

        Assert.True(frontDesk.CheckIn("Bob", "102"));
    }

    [Fact]
    public void GuestAlreadyCheckedInCannotStartASecondStay()
    {
        var frontDesk = HotelWithRooms("101", "102");
        frontDesk.CheckIn("Ada", "101");

        Assert.False(frontDesk.CheckIn("Ada", "102"));
        Assert.False(frontDesk.IsOccupied("102"));
    }

    [Fact]
    public void CheckOutLeavesTheRoomVacant()
    {
        var frontDesk = HotelWithRooms("101");
        frontDesk.CheckIn("Ada", "101");

        Assert.True(frontDesk.CheckOut("101"));
        Assert.False(frontDesk.IsOccupied("101"));
    }

    [Fact]
    public void CheckOutOfAnUnknownRoomIsRefused()
    {
        var frontDesk = HotelWithRooms("101");

        Assert.False(frontDesk.CheckOut("999"));
    }

    [Fact]
    public void CheckOutOfAVacantRoomIsRefused()
    {
        var frontDesk = HotelWithRooms("101");

        Assert.False(frontDesk.CheckOut("101"));
    }

    [Fact]
    public void CheckOutEndsTheStayOnlyOnce()
    {
        var frontDesk = HotelWithRooms("101");
        frontDesk.CheckIn("Ada", "101");
        frontDesk.CheckOut("101");

        Assert.False(frontDesk.CheckOut("101"));
    }

    [Fact]
    public void RoomHostsANewGuestAfterCheckOut()
    {
        var frontDesk = HotelWithRooms("101");
        frontDesk.CheckIn("Ada", "101");
        frontDesk.CheckOut("101");

        Assert.True(frontDesk.CheckIn("Bob", "101"));
        Assert.True(frontDesk.IsOccupied("101"));
    }

    [Fact]
    public void GuestChecksInAgainAfterCheckingOut()
    {
        var frontDesk = HotelWithRooms("101", "102");
        frontDesk.CheckIn("Ada", "101");
        frontDesk.CheckOut("101");

        Assert.True(frontDesk.CheckIn("Ada", "102"));
    }

    [Fact]
    public void EachRoomTracksItsOwnStay()
    {
        var frontDesk = HotelWithRooms("101", "102");
        frontDesk.CheckIn("Ada", "101");
        frontDesk.CheckIn("Bob", "102");

        Assert.True(frontDesk.IsOccupied("101"));
        Assert.True(frontDesk.IsOccupied("102"));

        frontDesk.CheckOut("101");

        Assert.False(frontDesk.IsOccupied("101"));
        Assert.True(frontDesk.IsOccupied("102"));
    }
}
