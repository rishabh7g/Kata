namespace Kata.Exercise;

public interface IClock
{
    // The current UTC moment; the Test Suite supplies a fake.
    DateTime UtcNow { get; }
}

public interface IRateLimiter
{
    // True — and the call is recorded — while fewer than 5 calls
    // for this key were recorded in the last 60 seconds (a call
    // ages out once it is MORE than 60 seconds old). A refused
    // call is never recorded. Keys are independent.
    bool TryPass(string key);
}
