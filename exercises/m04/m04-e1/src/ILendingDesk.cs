namespace Kata.Exercise;

public interface ILendingDesk
{
    // Puts one copy of the title on the shelf; call once per copy.
    void AddCopy(string title);

    // Lends one shelved copy to the member. False — and nothing is
    // recorded — when no copy is on the shelf, the member already
    // holds 3 loans, or the member already holds this title.
    bool CheckOut(string memberId, string title);

    // Takes the member's copy of the title back onto the shelf.
    // False when the member holds no loan of this title.
    bool Return(string memberId, string title);

    // Copies of the title on the shelf right now. Unknown title: 0.
    int CopiesOnShelf(string title);
}
