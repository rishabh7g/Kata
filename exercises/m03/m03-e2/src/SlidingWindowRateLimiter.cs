namespace Kata.Exercise;

// Construct stub: implement IRateLimiter one red test at a time, working
// the Test Suite top to bottom. All time must come from the injected
// IClock — never read DateTime.UtcNow inside this class.
public sealed class SlidingWindowRateLimiter : IRateLimiter
{
    private readonly IClock _clock;

    public SlidingWindowRateLimiter(IClock clock)
    {
        _clock = clock;
    }

    public bool TryPass(string key)
    {
        throw new NotImplementedException();
    }
}
