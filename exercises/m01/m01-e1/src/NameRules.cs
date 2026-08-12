namespace Kata.Exercise;

// Every caller must clean a document name the same way before touching disk,
// and must derive the shelf from the cleaned name, never the raw one.
public static class NameRules
{
    public static string Clean(string documentName)
    {
        string cleaned = documentName.Trim().ToLowerInvariant();
        cleaned = cleaned.Replace(' ', '_');
        return cleaned;
    }

    // Documents are shelved by first letter: "report" lives in "r/".
    // Anything not starting with an ASCII letter goes on the "_" shelf.
    public static string ShelfFor(string cleanedName)
    {
        if (cleanedName.Length == 0)
        {
            return "_";
        }
        char first = cleanedName[0];
        if (char.IsAsciiLetter(first))
        {
            return first.ToString();
        }
        return "_";
    }
}
