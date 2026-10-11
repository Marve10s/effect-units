---
"effect-units": minor
---

Block `effect-units/internal` and `effect-units/internal/*` package imports. Internal files still ship so the public modules' relative imports continue to work; only direct consumer access through private package subpaths is removed.
