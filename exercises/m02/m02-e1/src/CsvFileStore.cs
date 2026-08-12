namespace Kata.Exercise;

// A minimal append-only CSV file: one comma-separated row per line.
public class CsvFileStore
{
    public string FilePath { get; }

    public CsvFileStore(string filePath)
    {
        FilePath = filePath;
    }

    public void AppendLine(string csvLine)
    {
        File.AppendAllText(FilePath, csvLine + Environment.NewLine);
    }
}
