namespace Kata.Exercise;

// A second caller of FileCabinet. Note that the whole ritual — index file
// name, encoding name, shelf rule, extension — is spelled out all over again.
public class StoreStatistics
{
    private readonly string _rootFolder;

    public StoreStatistics(string rootFolder)
    {
        _rootFolder = rootFolder;
    }

    public int CountSavedDocuments()
    {
        string indexPath = Path.Combine(_rootFolder, "index.txt");
        if (!File.Exists(indexPath))
        {
            return 0;
        }
        int count = 0;
        var counted = new HashSet<string>();
        foreach (string line in File.ReadAllLines(indexPath, EncodingPicker.Pick("utf-8")))
        {
            string cleaned = NameRules.Clean(line);
            string shelf = NameRules.ShelfFor(cleaned);
            if (counted.Add(cleaned) &&
                FileCabinet.PayloadIsOnDisk(_rootFolder, shelf, cleaned, ".doc.txt"))
            {
                count++;
            }
        }
        return count;
    }
}
