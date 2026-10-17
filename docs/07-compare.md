# 07 · Comparing versions

Compare works on the latest finished review (status `done` or `partial`) of each version. Pure function in `lib/compare.ts`, fully unit tested.

## Matching an issue in "from" with an issue in "to"

Normalise every region to 0…1 of its image width and height first, because versions can have different sizes.

Two issues match when all of these hold:

1. Same `principle_id`
2. And either
   * both regions exist and their IoU (intersection over union) is at least 0.25, or
   * either region is null, or the IoU test fails, but the titles are similar: lower case, remove punctuation, token Jaccard similarity at least 0.5

Greedy matching: compute all candidate pairs with a score (IoU plus title similarity), take the best pair, remove both, repeat. One issue matches at most one other.

## Result

* **Fixed**: in "from", no match in "to"
* **Still open**: matched. Show the "to" issue. If the "from" issue has a pushback, show "I disagreed in v<from>: <reason>"
* **New**: in "to", no match in "from"

## Values for fixed measured issues

For a fixed measured issue, look for a measurement in the "to" review of the same kind whose normalised box overlaps (IoU at least 0.25) or whose label matches exactly. If found, show "was <old value>, now <new value>". If not found, show "was <old value>, no longer found". Never invent the new value.

## Tests

Fixtures for: identical versions (all still open), everything fixed, a moved element (title match), two issues with the same principle in different places (no cross match), null regions.
