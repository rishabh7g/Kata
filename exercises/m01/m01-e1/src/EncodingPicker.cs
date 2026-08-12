using System.Text;

namespace Kata.Exercise;

public static class EncodingPicker
{
    // Everything is stored as "utf-8" today, but every call site still has
    // to say so, and to spell it exactly like this.
    public static Encoding Pick(string encodingName)
    {
        if (encodingName == "utf-8")
        {
            return new UTF8Encoding(false);
        }
        if (encodingName == "ascii")
        {
            return Encoding.ASCII;
        }
        throw new ArgumentException("Unknown encoding name '" + encodingName + "'.");
    }
}
