using Xunit;
using Kata.Exercise;

namespace Kata.Exercise.Tests;

public sealed class LendingDeskTests
{
    // The only line that names the implementation. Every test below sees
    // nothing but the Target Interface.
    private static ILendingDesk CreateDesk() => new DeskManager();

    // --- AddCopy / CopiesOnShelf ---

    [Fact]
    public void Shelf_shows_zero_copies_of_a_title_never_added()
    {
        var desk = CreateDesk();

        Assert.Equal(0, desk.CopiesOnShelf("Dune"));
    }

    [Fact]
    public void Adding_a_copy_puts_one_copy_on_the_shelf()
    {
        var desk = CreateDesk();

        desk.AddCopy("Dune");

        Assert.Equal(1, desk.CopiesOnShelf("Dune"));
    }

    [Fact]
    public void Each_added_copy_of_the_same_title_is_counted()
    {
        var desk = CreateDesk();

        desk.AddCopy("Dune");
        desk.AddCopy("Dune");

        Assert.Equal(2, desk.CopiesOnShelf("Dune"));
    }

    [Fact]
    public void Copies_are_counted_per_title()
    {
        var desk = CreateDesk();

        desk.AddCopy("Dune");
        desk.AddCopy("Emma");
        desk.AddCopy("Emma");

        Assert.Equal(1, desk.CopiesOnShelf("Dune"));
        Assert.Equal(2, desk.CopiesOnShelf("Emma"));
    }

    // --- CheckOut ---

    [Fact]
    public void A_member_can_check_out_a_shelved_copy()
    {
        var desk = CreateDesk();
        desk.AddCopy("Dune");

        Assert.True(desk.CheckOut("m-1", "Dune"));
    }

    [Fact]
    public void Checking_out_takes_the_copy_off_the_shelf()
    {
        var desk = CreateDesk();
        desk.AddCopy("Dune");

        desk.CheckOut("m-1", "Dune");

        Assert.Equal(0, desk.CopiesOnShelf("Dune"));
    }

    [Fact]
    public void Check_out_fails_for_a_title_the_library_does_not_hold()
    {
        var desk = CreateDesk();

        Assert.False(desk.CheckOut("m-1", "Dune"));
    }

    [Fact]
    public void Check_out_fails_when_every_copy_is_already_lent_out()
    {
        var desk = CreateDesk();
        desk.AddCopy("Dune");
        desk.CheckOut("m-1", "Dune");

        Assert.False(desk.CheckOut("m-2", "Dune"));
    }

    [Fact]
    public void A_failed_check_out_records_no_loan()
    {
        var desk = CreateDesk();

        desk.CheckOut("m-1", "Dune"); // fails: nothing on the shelf

        desk.AddCopy("Dune");

        // Had the failed attempt been recorded, m-1 would now "already
        // hold this title" and this check-out would be refused.
        Assert.True(desk.CheckOut("m-1", "Dune"));
    }

    [Fact]
    public void A_member_cannot_hold_two_copies_of_the_same_title()
    {
        var desk = CreateDesk();
        desk.AddCopy("Dune");
        desk.AddCopy("Dune");
        desk.CheckOut("m-1", "Dune");

        Assert.False(desk.CheckOut("m-1", "Dune"));
        Assert.Equal(1, desk.CopiesOnShelf("Dune"));
    }

    [Fact]
    public void Two_members_can_each_hold_a_copy_of_the_same_title()
    {
        var desk = CreateDesk();
        desk.AddCopy("Dune");
        desk.AddCopy("Dune");

        Assert.True(desk.CheckOut("m-1", "Dune"));
        Assert.True(desk.CheckOut("m-2", "Dune"));
    }

    [Fact]
    public void A_member_cannot_hold_more_than_three_loans()
    {
        var desk = CreateDesk();
        foreach (var title in new[] { "Dune", "Emma", "Hamlet", "Iliad" })
        {
            desk.AddCopy(title);
        }
        desk.CheckOut("m-1", "Dune");
        desk.CheckOut("m-1", "Emma");
        desk.CheckOut("m-1", "Hamlet");

        Assert.False(desk.CheckOut("m-1", "Iliad"));
        Assert.Equal(1, desk.CopiesOnShelf("Iliad"));
    }

    // --- Return ---

    [Fact]
    public void Returning_a_loan_puts_the_copy_back_on_the_shelf()
    {
        var desk = CreateDesk();
        desk.AddCopy("Dune");
        desk.CheckOut("m-1", "Dune");

        Assert.True(desk.Return("m-1", "Dune"));
        Assert.Equal(1, desk.CopiesOnShelf("Dune"));
    }

    [Fact]
    public void Return_fails_when_the_member_holds_no_loan_of_the_title()
    {
        var desk = CreateDesk();
        desk.AddCopy("Dune");

        Assert.False(desk.Return("m-1", "Dune"));
        Assert.Equal(1, desk.CopiesOnShelf("Dune"));
    }

    [Fact]
    public void A_loan_cannot_be_returned_twice()
    {
        var desk = CreateDesk();
        desk.AddCopy("Dune");
        desk.CheckOut("m-1", "Dune");
        desk.Return("m-1", "Dune");

        Assert.False(desk.Return("m-1", "Dune"));
        Assert.Equal(1, desk.CopiesOnShelf("Dune"));
    }

    [Fact]
    public void Only_the_member_holding_the_loan_can_return_it()
    {
        var desk = CreateDesk();
        desk.AddCopy("Dune");
        desk.CheckOut("m-1", "Dune");

        Assert.False(desk.Return("m-2", "Dune"));
        Assert.Equal(0, desk.CopiesOnShelf("Dune"));
    }

    [Fact]
    public void A_member_can_borrow_a_title_again_after_returning_it()
    {
        var desk = CreateDesk();
        desk.AddCopy("Dune");
        desk.CheckOut("m-1", "Dune");
        desk.Return("m-1", "Dune");

        Assert.True(desk.CheckOut("m-1", "Dune"));
    }

    [Fact]
    public void Returning_a_loan_frees_a_slot_within_the_three_loan_limit()
    {
        var desk = CreateDesk();
        foreach (var title in new[] { "Dune", "Emma", "Hamlet", "Iliad" })
        {
            desk.AddCopy(title);
        }
        desk.CheckOut("m-1", "Dune");
        desk.CheckOut("m-1", "Emma");
        desk.CheckOut("m-1", "Hamlet");

        desk.Return("m-1", "Emma");

        Assert.True(desk.CheckOut("m-1", "Iliad"));
    }
}
