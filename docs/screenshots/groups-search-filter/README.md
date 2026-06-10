# Groups search & filter bar

Screenshots of the search + filter bar added to the **My Groups** page.

| State | Screenshot |
| --- | --- |
| Default (no filters) | `01-default.png` |
| Filter popover open | `02-filter-popover.png` |
| Filters applied (badge shows count, list narrowed) | `03-filters-applied.png` |
| Search acting as a filter | `04-search.png` |

Layout (top → bottom): page header → search + filter bar → Create Group →
Join Group → group cards. The bar itself is a search text field followed by a
small square filter icon button. Free-text search is debounced 750ms; tapping
a filter option applies immediately. "Pick type" (NFL / World Cup 2026) is
single-select; the icon button shows a count badge whenever a filter is active.
