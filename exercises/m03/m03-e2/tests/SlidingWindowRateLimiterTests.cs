using Xunit;
using Kata.Exercise;

namespace Kata.Exercise.Tests;

// Work these top to bottom, one red test at a time. Every test drives
// the limiter through the fake clock — no test ever waits on real time.
public class SlidingWindowRateLimiterTests
{
    private readonly FakeClock _clock = new();
    private readonly IRateLimiter _limiter;

    public SlidingWindowRateLimiterTests()
    {
        _limiter = new SlidingWindowRateLimiter(_clock);
    }

    [Fact]
    public void FirstCallPasses()
    {
        Assert.True(_limiter.TryPass("api"));
    }

    [Fact]
    public void FirstFiveCallsAllPass()
    {
        for (var i = 0; i < 5; i++)
        {
            Assert.True(_limiter.TryPass("api"));
        }
    }

    [Fact]
    public void SixthCallWithinTheWindowIsRefused()
    {
        for (var i = 0; i < 5; i++) _limiter.TryPass("api");

        Assert.False(_limiter.TryPass("api"));
    }

    [Fact]
    public void CallExactlySixtySecondsOldStillCounts()
    {
        for (var i = 0; i < 5; i++) _limiter.TryPass("api");

        _clock.Advance(TimeSpan.FromSeconds(60));

        Assert.False(_limiter.TryPass("api"));
    }

    [Fact]
    public void CallAgesOutOnceMoreThanSixtySecondsOld()
    {
        for (var i = 0; i < 5; i++) _limiter.TryPass("api");

        _clock.Advance(TimeSpan.FromSeconds(61));

        Assert.True(_limiter.TryPass("api"));
    }

    [Fact]
    public void WindowSlidesCallsAgeOutIndividually()
    {
        // 3 calls at t=0 and 2 at t=30: by t=61 only the first 3 have aged
        // out, so exactly 3 more calls fit before the limit bites again.
        for (var i = 0; i < 3; i++) _limiter.TryPass("api");
        _clock.Advance(TimeSpan.FromSeconds(30));
        for (var i = 0; i < 2; i++) _limiter.TryPass("api");
        _clock.Advance(TimeSpan.FromSeconds(31));

        Assert.True(_limiter.TryPass("api"));
        Assert.True(_limiter.TryPass("api"));
        Assert.True(_limiter.TryPass("api"));
        Assert.False(_limiter.TryPass("api"));
    }

    [Fact]
    public void RefusedCallsAreNeverRecorded()
    {
        // Refusals happen at t=30; the 5 recorded calls age out at t=61.
        // If refusals had been recorded they would still be in the window
        // at t=61 and this final call would be refused.
        for (var i = 0; i < 5; i++) _limiter.TryPass("api");
        _clock.Advance(TimeSpan.FromSeconds(30));
        for (var i = 0; i < 10; i++)
        {
            Assert.False(_limiter.TryPass("api"));
        }
        _clock.Advance(TimeSpan.FromSeconds(31));

        Assert.True(_limiter.TryPass("api"));
    }

    [Fact]
    public void KeysAreIndependent()
    {
        for (var i = 0; i < 5; i++) _limiter.TryPass("tenant-a");

        Assert.False(_limiter.TryPass("tenant-a"));
        Assert.True(_limiter.TryPass("tenant-b"));
    }

    private sealed class FakeClock : IClock
    {
        public DateTime UtcNow { get; private set; } =
            new(2026, 1, 1, 12, 0, 0, DateTimeKind.Utc);

        public void Advance(TimeSpan by) => UtcNow += by;
    }
}
