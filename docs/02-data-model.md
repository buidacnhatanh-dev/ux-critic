# 02 · Data model (SQLite with Drizzle)

All ids are text UUIDs. Times are ISO strings. JSON columns are text with zod validation on read.

## projects
| column | type | notes |
|---|---|---|
| id | text pk | |
| name | text | unique, shown in the sidebar lists |
| created_at | text | |

## versions
| column | type | notes |
|---|---|---|
| id | text pk | |
| project_id | text fk → projects, cascade delete | |
| name | text | "v1", "v2"…; unique per project |
| context | text | "What is this screen for?" answer, may be empty |
| screenshot_path | text | `data/screenshots/<id>.png` (always stored as PNG) |
| width, height | integer | original pixels |
| scale | integer | 1, 2 or 3: device pixels per CSS pixel, chosen on New review |
| created_at | text | |

## reviews
| column | type | notes |
|---|---|---|
| id | text pk | one review per version in v1, but keep the table separate for retries |
| version_id | text fk → versions, cascade | |
| status | text enum | `queued`, `running`, `done`, `partial`, `failed` |
| step | text enum | `prepare`, `measure`, `evaluate`, `place` |
| error | text null | short message for the Failed screen, plus technical detail |
| sources | text json | which principle sets and rule ids were on |
| skipped_checks | text json null | measured checks that did not run: `[{check: "target_size" \| "text", reason: "no_claude" \| "failed", detail}]` (M6) |
| model | text | value of UXC_MODEL at the time |
| input_tokens, output_tokens | integer | summed over both calls, from the API usage |
| started_at, finished_at | text | |

## measurements (every check, pass or fail, needed for Compare)
| column | type | notes |
|---|---|---|
| id | text pk | |
| review_id | text fk, cascade | |
| kind | text enum | `contrast`, `text_size`, `target_size` |
| label | text | OCR text or control label |
| box | text json | `{x,y,w,h}` in original image pixels |
| value | real | ratio, or CSS px |
| threshold | real | the limit it was checked against |
| passes | integer | 0 or 1 |

## issues
| column | type | notes |
|---|---|---|
| id | text pk | |
| review_id | text fk, cascade | |
| number | integer | 1…n in reading order (top to bottom, then left to right) |
| kind | text enum | `measured`, `evaluated` |
| principle_id | text | id from docs/05, or `rule:<rule id>` |
| title | text | short, like "Labels disappear while typing" |
| detail | text | what is wrong and why |
| fix | text | one suggested fix |
| severity | text enum | `high`, `medium`, `low` |
| confidence | text enum null | evaluated only |
| measurement_id | text null | measured only |
| region | text json null | `{x,y,w,h}` in original pixels, null means the whole screen |

## pushbacks
| column | type | notes |
|---|---|---|
| issue_id | text pk fk → issues, cascade | one reason per issue |
| reason | text | required, trimmed, not empty |
| created_at | text | |

## rules (my own checklist)
| column | type | notes |
|---|---|---|
| id | text pk | |
| text | text | "Touch targets are at least 44 by 44 px" |
| kind | text enum | `measured`, `evaluated` |
| metric | text enum null | measured only: `target_size_min`, `text_size_min`, `contrast_min` |
| threshold | real null | measured only, for example 44 |
| position | integer | order in the list |
| enabled | integer | 0 or 1 |

Seed rules on first run (the six from the design): targets 44 px (measured), body text 16 px (measured), visible field labels, one primary button per screen, error messages say how to fix, colour never alone (evaluated).

## settings
| key | value |
|---|---|
| `sources` | json `{"nielsen":true,"wcag":true,"laws":true,"mine":true}` |
