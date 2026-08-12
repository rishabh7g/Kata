namespace Kata.Exercise;

/// <summary>
/// A cache of recently used values, reachable through
/// <see cref="IRecentValues{T}"/>. The members below sketch one possible
/// starting shape for the implementation.
/// </summary>
public class RecentValues<T> : IRecentValues<T>
{
    /// <summary>
    /// Maximum number of entries. Callers can tune this for their workload.
    /// </summary>
    public int Capacity
    {
        get => throw new NotImplementedException();
        set => throw new NotImplementedException();
    }

    /// <summary>
    /// The keys in the order they will be evicted, oldest first, so callers
    /// can check what is about to fall out before it does.
    /// </summary>
    public IReadOnlyList<string> EvictionOrder => throw new NotImplementedException();

    /// <summary>
    /// Removes entries that are no longer recent. Callers should remember to
    /// call this before reading, or stale values may come back.
    /// </summary>
    public void PurgeExpired() => throw new NotImplementedException();

    public void Put(string key, T value) => throw new NotImplementedException();

    public bool TryGet(string key, out T? value) => throw new NotImplementedException();
}
