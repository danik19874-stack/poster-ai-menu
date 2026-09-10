-- Add support for Poster oAuth-based onboarding.
-- poster_account_number is the natural key for the oAuth callback's upsert:
-- there is no restaurant row yet when the oAuth redirect arrives, so this
-- is what we upsert on instead of our own generated id. Nullable because
-- the pre-existing manual-token onboarding path never sets it.
alter table restaurants
  add column poster_account_number text unique;
