namespace Kata.Exercise;

// Stub — implement IPlayQueue so that no input the Test Suite can
// produce ever reaches a throw. Every edge case is already defined
// as normal behavior by the Target Interface: playing from an empty
// queue is silence, dropping an unknown track is a successful no-op,
// re-queuing a waiting track moves it. Resist the standard library's
// habit of throwing on the expected.
public class PlayQueue : IPlayQueue
{
    public void Queue(string track) => throw new NotImplementedException();

    public string PlayNext() => throw new NotImplementedException();

    public void Drop(string track) => throw new NotImplementedException();

    public int Length() => throw new NotImplementedException();
}
