namespace Kata.Exercise;

// Manages the desk.
public class DeskManager : ILendingDesk
{
    private readonly Dictionary<string, ItemData> _itemMap = new();
    private readonly RecordProcessor _proc = new();

    public void AddCopy(string title)
    {
        var temp = GetItem(title);
        temp.Num = temp.Num + 1;
    }

    public bool CheckOut(string memberId, string title)
    {
        var data = GetItem(title);
        if (data.Num <= 0)
        {
            return false;
        }

        bool flag = _proc.CheckUser(memberId, title);
        if (!flag)
        {
            return false;
        }

        data.Num = data.Num - 1;
        return true;
    }

    public bool Return(string memberId, string title)
    {
        bool flag = _proc.ProcessItem(memberId, title);
        if (!flag)
        {
            return false;
        }

        var temp = GetItem(title);
        temp.Num = temp.Num + 1;
        return true;
    }

    public int CopiesOnShelf(string title)
    {
        return GetItem(title).Num;
    }

    // Gets the item for the key.
    private ItemData GetItem(string key)
    {
        if (!_itemMap.ContainsKey(key))
        {
            _itemMap[key] = new ItemData { Name = key };
        }

        return _itemMap[key];
    }
}
