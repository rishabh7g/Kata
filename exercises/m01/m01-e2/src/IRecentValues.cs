namespace Kata.Exercise;

public interface IRecentValues<T>
{
    void Put(string key, T value);
    bool TryGet(string key, out T? value);
}
