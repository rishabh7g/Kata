namespace Kata.Exercise;

public interface IDocumentStore
{
    void Save(string documentName, string contents);
    string Load(string documentName);
    bool Exists(string documentName);
}
