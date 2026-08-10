# Course CSV import format

The admin course importer accepts `.csv` and `.xlsx` files. The first row must
contain column headers. `title_he` is the only required field; the other
columns may be left empty.

```csv
title_he,description_he,category,target_age_group,min_age,max_age,days_of_week,start_time,end_time,price,instructor_name,location,max_participants,is_active
יוגה למתחילים,תרגול יוגה לכל הרמות,ספורט,adults,18,80,שני,18:00,19:00,180,דנה כהן,אולם ספורט,20,true
```

Accepted values:

- `target_age_group`: `kids`, `teens`, `adults`, `seniors` (or the equivalent Hebrew labels shown in the importer).
- `start_time` and `end_time`: `HH:MM`, for example `18:00`.
- `price`, `min_age`, `max_age`, and `max_participants`: numbers; currency symbols are allowed for price.
- `is_active`: `true`/`false`, `1`/`0`, `yes`/`no`, or `כן`/`לא`.
- `category`: the Hebrew category name. Existing categories are reused case-insensitively; a new category is created only when the name does not already exist.

The importer shows a mapping step, validates rows, detects duplicates, and only
writes rows after the preview is approved.
