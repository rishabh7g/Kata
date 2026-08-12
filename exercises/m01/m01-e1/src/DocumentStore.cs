namespace Kata.Exercise;

public class DocumentStore : IDocumentStore
{
    private readonly string _rootFolder;

    public DocumentStore(string rootFolder)
    {
        _rootFolder = rootFolder;
        FileCabinet.EnsureFolder(_rootFolder, "");
    }

    public void Save(string documentName, string contents)
    {
        // The saving ritual. Order matters: the payload must be on disk
        // before the index line is appended, and Load refuses anything
        // that has no index line yet.
        string cleaned = NameRules.Clean(documentName);
        string shelf = NameRules.ShelfFor(cleaned);
        FileCabinet.EnsureFolder(_rootFolder, shelf);
        FileCabinet.WritePayload(_rootFolder, shelf, cleaned, ".doc.txt", contents, "utf-8");
        FileCabinet.AppendIndexLine(_rootFolder, "index.txt", cleaned, "utf-8");
    }

    public string Load(string documentName)
    {
        // The loading ritual mirrors the saving ritual step for step; get
        // any one argument wrong and you read the wrong file, or nothing.
        string cleaned = NameRules.Clean(documentName);
        string shelf = NameRules.ShelfFor(cleaned);
        if (!FileCabinet.IndexHasLine(_rootFolder, "index.txt", cleaned, "utf-8"))
        {
            throw new InvalidOperationException(
                "Document '" + documentName + "' has no index line; Save must run before Load.");
        }
        return FileCabinet.ReadPayload(_rootFolder, shelf, cleaned, ".doc.txt", "utf-8");
    }

    public bool Exists(string documentName)
    {
        string cleaned = NameRules.Clean(documentName);
        string shelf = NameRules.ShelfFor(cleaned);
        if (!FileCabinet.IndexHasLine(_rootFolder, "index.txt", cleaned, "utf-8"))
        {
            return false;
        }
        return FileCabinet.PayloadIsOnDisk(_rootFolder, shelf, cleaned, ".doc.txt");
    }
}
