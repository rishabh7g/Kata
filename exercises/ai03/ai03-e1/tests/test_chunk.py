"""What `chunk` must do, written from the Target Interface alone.

Every expected value here can be counted by hand: the boundaries are read off
a plain alphabet string, and the overlap is checked as text the two pieces
share rather than as an index.
"""
import pytest

from retrieval import chunk

HANDBOOK = (
    "In cold weather the engine will not start. Hold the key down for ten "
    "seconds before you turn it over."
)


def test_cuts_the_text_at_the_expected_boundaries():
    assert chunk("abcdefghij", 4, 1) == ["abcd", "defg", "ghij"]


def test_consecutive_pieces_share_exactly_the_overlap():
    pieces = chunk(HANDBOOK, 30, 8)

    assert len(pieces) > 2
    for earlier, later in zip(pieces, pieces[1:]):
        assert earlier[-8:] == later[:8]


def test_every_piece_but_the_last_is_a_full_size_piece():
    pieces = chunk(HANDBOOK, 30, 8)

    assert all(len(piece) == 30 for piece in pieces[:-1])
    assert 0 < len(pieces[-1]) <= 30


def test_no_overlap_puts_the_text_back_together_exactly():
    pieces = chunk(HANDBOOK, 25, 0)

    assert "".join(pieces) == HANDBOOK


def test_a_text_that_divides_evenly_leaves_no_empty_piece():
    assert chunk("abcdefgh", 4, 0) == ["abcd", "efgh"]


def test_a_text_shorter_than_one_piece_comes_back_whole():
    assert chunk("cold", 30, 8) == ["cold"]


def test_empty_text_gives_no_pieces():
    assert chunk("", 30, 8) == []


@pytest.mark.parametrize("size,overlap", [(0, 0), (-4, 0), (10, -1), (10, 10), (10, 11)])
def test_rejects_a_size_and_overlap_that_would_never_finish(size, overlap):
    with pytest.raises(ValueError):
        chunk(HANDBOOK, size, overlap)
