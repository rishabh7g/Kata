using Kata.Exercise;
using Xunit;

namespace Kata.Exercise.Tests;

public class RecentValuesTests
{
    // Every test talks to the cache through the Target Interface alone.
    // This is the only line that names a concrete class.
    private static IRecentValues<T> CreateCache<T>() => new RecentValues<T>();

    [Fact]
    public void TryGet_returns_false_for_a_key_that_was_never_put()
    {
        var cache = CreateCache<string>();

        var found = cache.TryGet("missing", out var value);

        Assert.False(found);
        Assert.Null(value);
    }

    [Fact]
    public void TryGet_leaves_value_at_default_for_a_missing_value_type()
    {
        var cache = CreateCache<int>();

        var found = cache.TryGet("missing", out var value);

        Assert.False(found);
        Assert.Equal(0, value);
    }

    [Theory]
    [InlineData("answer")]
    [InlineData("")]
    [InlineData("a longer value, with punctuation and spaces")]
    public void Put_then_TryGet_returns_true_and_the_stored_value(string stored)
    {
        var cache = CreateCache<string>();

        cache.Put("key", stored);
        var found = cache.TryGet("key", out var value);

        Assert.True(found);
        Assert.Equal(stored, value);
    }

    [Fact]
    public void Put_and_TryGet_work_with_value_types()
    {
        var cache = CreateCache<int>();

        cache.Put("count", 42);
        var found = cache.TryGet("count", out var value);

        Assert.True(found);
        Assert.Equal(42, value);
    }

    [Fact]
    public void Put_with_an_existing_key_overwrites_the_value()
    {
        var cache = CreateCache<string>();

        cache.Put("key", "first");
        cache.Put("key", "second");
        var found = cache.TryGet("key", out var value);

        Assert.True(found);
        Assert.Equal("second", value);
    }

    [Fact]
    public void Distinct_keys_hold_distinct_values()
    {
        var cache = CreateCache<string>();

        cache.Put("alpha", "1");
        cache.Put("beta", "2");

        Assert.True(cache.TryGet("alpha", out var alpha));
        Assert.True(cache.TryGet("beta", out var beta));
        Assert.Equal("1", alpha);
        Assert.Equal("2", beta);
    }

    [Fact]
    public void TryGet_can_be_repeated_without_consuming_the_entry()
    {
        var cache = CreateCache<string>();
        cache.Put("key", "value");

        Assert.True(cache.TryGet("key", out var first));
        Assert.True(cache.TryGet("key", out var second));
        Assert.Equal("value", first);
        Assert.Equal("value", second);
    }

    [Fact]
    public void The_empty_string_is_a_valid_key()
    {
        var cache = CreateCache<string>();

        cache.Put("", "empty-key value");
        var found = cache.TryGet("", out var value);

        Assert.True(found);
        Assert.Equal("empty-key value", value);
    }

    [Fact]
    public void The_most_recently_put_entry_is_always_retrievable()
    {
        // The cache decides its own capacity, eviction order, and expiry.
        // Whatever it decides, the entry that was just Put must survive:
        // a recent-values cache that drops its newest entry keeps nothing.
        var cache = CreateCache<int>();

        for (var i = 0; i < 10_000; i++)
        {
            var key = $"key-{i}";
            cache.Put(key, i);

            Assert.True(cache.TryGet(key, out var value));
            Assert.Equal(i, value);
        }
    }

    [Fact]
    public void Putting_an_old_key_again_makes_it_immediately_retrievable()
    {
        var cache = CreateCache<string>();
        cache.Put("revisited", "old");

        for (var i = 0; i < 10_000; i++)
        {
            cache.Put($"filler-{i}", "x");
        }

        cache.Put("revisited", "new");
        var found = cache.TryGet("revisited", out var value);

        Assert.True(found);
        Assert.Equal("new", value);
    }

    [Fact]
    public void A_key_never_put_stays_missing_no_matter_how_full_the_cache_gets()
    {
        var cache = CreateCache<int>();

        for (var i = 0; i < 10_000; i++)
        {
            cache.Put($"key-{i}", i);
        }

        Assert.False(cache.TryGet("never-put", out _));
    }
}
