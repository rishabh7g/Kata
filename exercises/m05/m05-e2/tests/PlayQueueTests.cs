using Kata.Exercise;
using Xunit;

namespace Kata.Exercise.Tests;

public class PlayQueueTests
{
    private static IPlayQueue NewQueue() => new PlayQueue();

    // --- Empty queue is a normal state, not an error ---

    [Fact]
    public void PlayNext_OnAnEmptyQueue_ReturnsSilence()
    {
        var queue = NewQueue();

        Assert.Equal("", queue.PlayNext());
    }

    [Fact]
    public void PlayNext_OnAnEmptyQueue_CanBeCalledRepeatedly()
    {
        var queue = NewQueue();

        Assert.Equal("", queue.PlayNext());
        Assert.Equal("", queue.PlayNext());
        Assert.Equal(0, queue.Length());
    }

    [Fact]
    public void PlayNext_AfterTheLastTrackPlays_ReturnsSilence()
    {
        var queue = NewQueue();
        queue.Queue("Blue in Green");

        queue.PlayNext();

        Assert.Equal("", queue.PlayNext());
    }

    // --- FIFO playback ---

    [Fact]
    public void Queue_ThenPlayNext_ReturnsTheQueuedTrack()
    {
        var queue = NewQueue();
        queue.Queue("So What");

        Assert.Equal("So What", queue.PlayNext());
    }

    [Fact]
    public void Tracks_PlayInTheOrderTheyWereQueued()
    {
        var queue = NewQueue();
        queue.Queue("So What");
        queue.Queue("Freddie Freeloader");
        queue.Queue("Blue in Green");

        Assert.Equal("So What", queue.PlayNext());
        Assert.Equal("Freddie Freeloader", queue.PlayNext());
        Assert.Equal("Blue in Green", queue.PlayNext());
    }

    [Fact]
    public void PlayNext_RemovesTheTrackItReturns()
    {
        var queue = NewQueue();
        queue.Queue("So What");

        queue.PlayNext();

        Assert.Equal(0, queue.Length());
    }

    // --- Length counts tracks waiting right now ---

    [Fact]
    public void Length_OnANewQueue_IsZero()
    {
        var queue = NewQueue();

        Assert.Equal(0, queue.Length());
    }

    [Fact]
    public void Length_CountsEveryWaitingTrack()
    {
        var queue = NewQueue();
        queue.Queue("So What");
        queue.Queue("Freddie Freeloader");

        Assert.Equal(2, queue.Length());
    }

    // --- Re-queuing a waiting track is a preference, not a fault ---

    [Fact]
    public void Queue_AWaitingTrackAgain_DoesNotDuplicateIt()
    {
        var queue = NewQueue();
        queue.Queue("So What");

        queue.Queue("So What");

        Assert.Equal(1, queue.Length());
    }

    [Fact]
    public void Queue_AWaitingTrackAgain_MovesItToTheEnd()
    {
        var queue = NewQueue();
        queue.Queue("So What");
        queue.Queue("Freddie Freeloader");

        queue.Queue("So What");

        Assert.Equal(2, queue.Length());
        Assert.Equal("Freddie Freeloader", queue.PlayNext());
        Assert.Equal("So What", queue.PlayNext());
    }

    [Fact]
    public void Queue_ATrackThatAlreadyPlayed_IsAFreshAdd()
    {
        var queue = NewQueue();
        queue.Queue("So What");
        queue.PlayNext();

        queue.Queue("So What");

        Assert.Equal(1, queue.Length());
        Assert.Equal("So What", queue.PlayNext());
    }

    // --- Drop ensures absence; it never fails ---

    [Fact]
    public void Drop_RemovesTheTrackFromTheQueue()
    {
        var queue = NewQueue();
        queue.Queue("So What");
        queue.Queue("Freddie Freeloader");

        queue.Drop("So What");

        Assert.Equal(1, queue.Length());
        Assert.Equal("Freddie Freeloader", queue.PlayNext());
    }

    [Fact]
    public void Drop_AMiddleTrack_PreservesTheOrderOfTheRest()
    {
        var queue = NewQueue();
        queue.Queue("So What");
        queue.Queue("Freddie Freeloader");
        queue.Queue("Blue in Green");

        queue.Drop("Freddie Freeloader");

        Assert.Equal("So What", queue.PlayNext());
        Assert.Equal("Blue in Green", queue.PlayNext());
    }

    [Fact]
    public void Drop_ATrackThatWasNeverQueued_IsASuccessfulNoOp()
    {
        var queue = NewQueue();
        queue.Queue("So What");

        queue.Drop("Giant Steps");

        Assert.Equal(1, queue.Length());
        Assert.Equal("So What", queue.PlayNext());
    }

    [Fact]
    public void Drop_OnAnEmptyQueue_IsASuccessfulNoOp()
    {
        var queue = NewQueue();

        queue.Drop("Giant Steps");

        Assert.Equal(0, queue.Length());
    }

    [Fact]
    public void Drop_TheSameTrackTwice_IsStillSuccessful()
    {
        var queue = NewQueue();
        queue.Queue("So What");

        queue.Drop("So What");
        queue.Drop("So What");

        Assert.Equal(0, queue.Length());
    }

    [Fact]
    public void Drop_TheOnlyTrack_ThenPlayNext_ReturnsSilence()
    {
        var queue = NewQueue();
        queue.Queue("So What");

        queue.Drop("So What");

        Assert.Equal("", queue.PlayNext());
    }

    // --- The headline claim: no sequence of calls ever throws ---

    [Fact]
    public void NoSequenceOfCalls_EverThrows()
    {
        var queue = NewQueue();

        var exception = Record.Exception(() =>
        {
            queue.PlayNext();                    // play from empty
            queue.Drop("Giant Steps");           // drop from empty
            queue.Queue("So What");
            queue.Queue("So What");              // re-queue a waiting track
            queue.Queue("Freddie Freeloader");
            queue.Drop("Blue in Green");         // drop a track never queued
            queue.PlayNext();
            queue.PlayNext();
            queue.PlayNext();                    // play past the end
            queue.Drop("So What");               // drop an already-played track
            queue.Length();
        });

        Assert.Null(exception);
    }
}
