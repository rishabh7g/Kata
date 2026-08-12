namespace Kata.Exercise;

// A second policy-side caller pointed at the same concrete detail: the
// overdue report re-reads and re-parses the raw CSV itself, duplicating
// the ledger's knowledge of the file layout and row format.
public class OverdueReport
{
    private readonly string _csvFilePath;

    public OverdueReport(string csvFilePath)
    {
        _csvFilePath = csvFilePath;
    }

    // Every rentalId with a CHECKOUT row but no RETURN row, in checkout order.
    public IReadOnlyList<string> UnreturnedRentalIds()
    {
        var checkedOut = new List<string>();
        var returned = new HashSet<string>();

        if (!File.Exists(_csvFilePath))
        {
            return checkedOut;
        }

        foreach (string csvLine in File.ReadAllLines(_csvFilePath))
        {
            string[] csvFields = csvLine.Split(',');
            if (csvFields.Length != 3)
            {
                continue;
            }

            if (csvFields[0] == "CHECKOUT" && !checkedOut.Contains(csvFields[1]))
            {
                checkedOut.Add(csvFields[1]);
            }

            if (csvFields[0] == "RETURN")
            {
                returned.Add(csvFields[1]);
            }
        }

        checkedOut.RemoveAll(returned.Contains);
        return checkedOut;
    }
}
