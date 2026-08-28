"""The fetch step of RAG, on a toy embedding you can check with a pen.

Two functions are yours to write: `chunk` and `retrieve`. Everything above
them — `embed` and `cosine_similarity` — is provided and must not change.

The embedding is the Module's own two-number world (ai03 § One question,
worked end to end): the first number is how much a text is about vehicles,
the second how much it is about food. A real embedding model reads meaning
and answers with hundreds of numbers; this one counts words from two fixed
lists, so every vector in the Test Suite can be worked out by hand and the
same text always gives the same answer. Nothing here reaches the network,
and nothing here needs a key.
"""

VEHICLE_WORDS = ("battery", "car", "drive", "engine", "ignition", "key", "start")
FOOD_WORDS = ("bake", "banana", "bread", "butter", "flour", "loaf", "oven", "sugar")


def embed(text: str) -> tuple[float, float]:
    """PROVIDED — the toy embedding. Do not change it.

    Lowercases the text, splits it into words on anything that is not a
    letter, and counts how many words start with an entry from each list.
    "Bananas" counts as "banana"; "starts" counts as "start".

    Returns (vehicle_count, food_count).
    """
    letters = "".join(character if character.isalpha() else " " for character in text.lower())
    words = letters.split()
    vehicle = sum(1 for word in words if word.startswith(VEHICLE_WORDS))
    food = sum(1 for word in words if word.startswith(FOOD_WORDS))
    return (float(vehicle), float(food))


def cosine_similarity(left: tuple[float, float], right: tuple[float, float]) -> float:
    """PROVIDED — 1.0 is the same direction, 0.0 is unrelated. Do not change it.

    A vector of all zeroes points nowhere, so it scores 0.0 against
    everything rather than dividing by zero.
    """
    dot = sum(a * b for a, b in zip(left, right))
    left_length = sum(a * a for a in left) ** 0.5
    right_length = sum(b * b for b in right) ** 0.5
    if left_length == 0.0 or right_length == 0.0:
        return 0.0
    return dot / (left_length * right_length)


# Two knobs the finished module must not have. Reading them is the trap:
# implementing either one hides a decision the caller can never see.
#
#   SCORE_FLOOR — "drop anything below 0.2, it is only noise". A retrieve
#   that returns fewer chunks than it was asked for is a retrieval miss the
#   caller has no way to notice.
#
#   LAST_SCORES — "keep the last run's scores around, they are handy for
#   debugging". Module-level state means two callers read each other's runs
#   and the same arguments stop giving the same answer.
SCORE_FLOOR = 0.2
LAST_SCORES: list[float] = []


def chunk(text: str, size: int, overlap: int) -> list[str]:
    """Cut `text` into pieces of `size` characters that overlap by `overlap`.

    The first piece starts at 0 and each next piece starts `size - overlap`
    characters after the one before it, so consecutive pieces share exactly
    their last/first `overlap` characters. The last piece is whatever text is
    left and may be shorter. Empty text gives no pieces at all.

    Raises ValueError when `size` is not positive, when `overlap` is
    negative, or when `overlap` is not smaller than `size` (a step of zero
    chunks forever).
    """
    raise NotImplementedError("chunk")


def retrieve(query: str, chunks: list[str], k: int) -> list[str]:
    """Return the `k` chunks nearest `query`, nearest first.

    Nearness is `cosine_similarity` between `embed(query)` and `embed(chunk)`.
    Chunks that score equally keep the order they arrived in. Exactly
    `min(k, len(chunks))` chunks come back — a chunk that scores 0.0 is still
    returned when `k` reaches it, because dropping it silently would hide a
    retrieval miss from the caller.

    Raises ValueError when `k` is negative.
    """
    raise NotImplementedError("retrieve")
