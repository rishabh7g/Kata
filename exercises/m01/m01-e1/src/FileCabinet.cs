namespace Kata.Exercise;

// Thin wrappers over System.IO. Callers assemble these into the save/load
// rituals themselves; see DocumentStore and StoreStatistics.
public static class FileCabinet
{
    public static void EnsureFolder(string root, string shelf)
    {
        Directory.CreateDirectory(Path.Combine(root, shelf));
    }

    public static void WritePayload(string root, string shelf, string cleanedName,
        string extension, string payload, string encodingName)
    {
        string path = Path.Combine(root, shelf, cleanedName + extension);
        File.WriteAllText(path, payload, EncodingPicker.Pick(encodingName));
    }

    public static string ReadPayload(string root, string shelf, string cleanedName,
        string extension, string encodingName)
    {
        string path = Path.Combine(root, shelf, cleanedName + extension);
        return File.ReadAllText(path, EncodingPicker.Pick(encodingName));
    }

    public static bool PayloadIsOnDisk(string root, string shelf, string cleanedName,
        string extension)
    {
        return File.Exists(Path.Combine(root, shelf, cleanedName + extension));
    }

    public static void AppendIndexLine(string root, string indexFileName,
        string cleanedName, string encodingName)
    {
        string path = Path.Combine(root, indexFileName);
        File.AppendAllText(path, cleanedName + Environment.NewLine,
            EncodingPicker.Pick(encodingName));
    }

    public static bool IndexHasLine(string root, string indexFileName,
        string cleanedName, string encodingName)
    {
        string path = Path.Combine(root, indexFileName);
        if (!File.Exists(path))
        {
            return false;
        }
        foreach (string line in File.ReadAllLines(path, EncodingPicker.Pick(encodingName)))
        {
            if (line == cleanedName)
            {
                return true;
            }
        }
        return false;
    }
}
