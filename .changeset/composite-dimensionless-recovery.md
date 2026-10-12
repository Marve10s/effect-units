---
"effect-units": patch
---

Recover dimensionless factors correctly when generic multiplication folds them into an area or another product unit. Fix both float and exact `over` / `over_` operations, including curried and unsafe forms, without changing public signatures or wire formats.
