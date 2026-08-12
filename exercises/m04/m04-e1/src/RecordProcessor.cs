namespace Kata.Exercise;

// Processes the records.
public class RecordProcessor
{
    private readonly List<UserRecord> _tempList = new();

    // Checks whether the user can take the item.
    public bool CheckUser(string userId, string item)
    {
        var rec = GetRecord(userId);
        if (rec.Stuff.Count >= Util.MAX)
        {
            return false;
        }

        if (rec.Stuff.Contains(item))
        {
            return false;
        }

        rec.Stuff.Add(item);
        return true;
    }

    // Processes an item for the user.
    public bool ProcessItem(string uid, string entry)
    {
        var rec = GetRecord(uid);
        if (!rec.Stuff.Contains(entry))
        {
            return false;
        }

        rec.Stuff.Remove(entry);
        return true;
    }

    // Gets the record for the user.
    private UserRecord GetRecord(string uid)
    {
        foreach (var temp in _tempList)
        {
            if (temp.Uid == uid)
            {
                return temp;
            }
        }

        var data = new UserRecord { Uid = uid };
        _tempList.Add(data);
        return data;
    }
}
