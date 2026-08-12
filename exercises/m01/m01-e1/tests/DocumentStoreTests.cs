using Xunit;
using Kata.Exercise;

namespace Kata.Exercise.Tests;

public sealed class DocumentStoreTests : IDisposable
{
    private readonly string _rootFolder =
        Path.Combine(Path.GetTempPath(), "kata-m01-e1-" + Guid.NewGuid().ToString("N"));

    // The only line that names the implementation. Every test below sees
    // nothing but the Target Interface.
    private IDocumentStore CreateStore() => new DocumentStore(_rootFolder);

    public void Dispose()
    {
        if (Directory.Exists(_rootFolder))
        {
            Directory.Delete(_rootFolder, recursive: true);
        }
    }

    [Fact]
    public void Exists_is_false_for_a_document_that_was_never_saved()
    {
        var store = CreateStore();

        Assert.False(store.Exists("never-saved"));
    }

    [Fact]
    public void Exists_is_true_after_a_document_is_saved()
    {
        var store = CreateStore();

        store.Save("meeting-notes", "agenda");

        Assert.True(store.Exists("meeting-notes"));
    }

    [Fact]
    public void Save_then_Load_round_trips_the_contents()
    {
        var store = CreateStore();

        store.Save("meeting-notes", "agenda for Tuesday");

        Assert.Equal("agenda for Tuesday", store.Load("meeting-notes"));
    }

    [Fact]
    public void Load_returns_the_latest_contents_after_an_overwrite()
    {
        var store = CreateStore();

        store.Save("draft", "first version");
        store.Save("draft", "second version");

        Assert.Equal("second version", store.Load("draft"));
    }

    [Fact]
    public void Load_throws_for_a_document_that_was_never_saved()
    {
        var store = CreateStore();

        Assert.ThrowsAny<Exception>(() => store.Load("missing"));
    }

    [Fact]
    public void Documents_with_different_names_are_stored_independently()
    {
        var store = CreateStore();

        store.Save("alpha", "contents of alpha");
        store.Save("beta", "contents of beta");

        Assert.Equal("contents of alpha", store.Load("alpha"));
        Assert.Equal("contents of beta", store.Load("beta"));
    }

    [Fact]
    public void Documents_survive_a_new_store_instance_on_the_same_root()
    {
        CreateStore().Save("persisted", "still here");

        var reopened = CreateStore();

        Assert.True(reopened.Exists("persisted"));
        Assert.Equal("still here", reopened.Load("persisted"));
    }

    [Theory]
    [InlineData("")]
    [InlineData("one line")]
    [InlineData("line one\nline two\nline three")]
    [InlineData("naïve café — 東京 🗂️")]
    public void Load_returns_exactly_what_was_saved(string contents)
    {
        var store = CreateStore();

        store.Save("round-trip", contents);

        Assert.Equal(contents, store.Load("round-trip"));
    }

    [Theory]
    [InlineData("notes")]
    [InlineData("Quarterly Report")]
    [InlineData("2026-plan")]
    [InlineData("UPPERCASE")]
    public void Any_reasonable_document_name_round_trips(string documentName)
    {
        var store = CreateStore();

        store.Save(documentName, "contents for " + documentName);

        Assert.True(store.Exists(documentName));
        Assert.Equal("contents for " + documentName, store.Load(documentName));
    }
}
