namespace Kata.Exercise;

public interface IPlayQueue
{
    // Adds the track to the end of the queue. Queuing a track that
    // is already waiting moves it to the end instead of duplicating
    // it — asking twice is a preference, not a fault.
    void Queue(string track);

    // Removes and returns the next track, or "" (silence) when the
    // queue is empty. An empty queue is a normal state, not an
    // error.
    string PlayNext();

    // Ensures the track is not in the queue. Dropping a track that
    // was never queued is a successful no-op.
    void Drop(string track);

    // Tracks waiting right now.
    int Length();
}
