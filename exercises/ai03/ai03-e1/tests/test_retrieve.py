"""What `retrieve` must do, written from the Target Interface alone.

The four chunks below are the help desk's handbook, and their toy vectors are
short enough to check with a pen (`embed` counts words from two fixed lists):

    CAR      (3, 0)   engine, start, key
    RECIPE   (0, 5)   butter, sugar, bananas, bake, loaf
    DELIVERY (2, 2)   start, engine · bread, butter
    LEAVE    (0, 0)   nothing from either list

The car question embeds to (2, 0) and the baking question to (0, 3), so the
ranking each one produces is arithmetic, not judgement.
"""
import pytest

from retrieval import chunk, retrieve

CAR = "In cold weather the engine will not start. Hold the key down for ten seconds."
RECIPE = "Cream the butter and sugar, fold in the mashed bananas, and bake the loaf."
DELIVERY = "Load the bread and the butter into the cool box before you start the engine."
LEAVE = "Annual leave is booked through the staff portal, two weeks ahead."

HANDBOOK = [CAR, RECIPE, DELIVERY, LEAVE]

CAR_QUESTION = "my car will not start"
BAKING_QUESTION = "how long do I bake the banana bread"


def test_the_car_question_fetches_the_car_chunk():
    assert retrieve(CAR_QUESTION, HANDBOOK, 1) == [CAR]


def test_the_nearest_chunks_come_back_nearest_first():
    assert retrieve(CAR_QUESTION, HANDBOOK, 2) == [CAR, DELIVERY]


def test_a_different_question_reorders_the_same_chunks():
    assert retrieve(BAKING_QUESTION, HANDBOOK, 2) == [RECIPE, DELIVERY]


def test_returns_exactly_k_chunks_even_when_the_far_ones_score_nothing():
    fetched = retrieve(CAR_QUESTION, HANDBOOK, 4)

    assert len(fetched) == 4
    assert fetched[:2] == [CAR, DELIVERY]
    assert sorted(fetched) == sorted(HANDBOOK)


def test_asking_for_more_chunks_than_exist_returns_all_of_them():
    assert len(retrieve(CAR_QUESTION, HANDBOOK, 99)) == len(HANDBOOK)


def test_asking_for_none_fetches_none():
    assert retrieve(CAR_QUESTION, HANDBOOK, 0) == []


def test_an_empty_store_fetches_nothing():
    assert retrieve(CAR_QUESTION, [], 4) == []


def test_rejects_a_negative_k():
    with pytest.raises(ValueError):
        retrieve(CAR_QUESTION, HANDBOOK, -1)


def test_chunks_that_score_the_same_keep_the_order_they_arrived_in():
    first = "Start the engine."
    second = "The engine will start."

    assert retrieve(CAR_QUESTION, [first, second], 2) == [first, second]
    assert retrieve(CAR_QUESTION, [second, first], 2) == [second, first]


def test_the_same_question_twice_fetches_the_same_chunks_and_changes_nothing():
    store = list(HANDBOOK)

    assert retrieve(CAR_QUESTION, store, 2) == retrieve(CAR_QUESTION, store, 2)
    assert store == HANDBOOK


def test_the_two_steps_together_fetch_the_passage_that_answers_the_question():
    pieces = chunk(" ".join(HANDBOOK), 80, 20)

    assert "key" in retrieve(CAR_QUESTION, pieces, 1)[0]
