-- poster_spot_id is only unique *within* one Poster account, not globally —
-- the original standalone `unique` here breaks as soon as a second
-- self-service (oAuth) restaurant's first spot is also spot_id=1. Scope the
-- uniqueness to (poster_account_number, poster_spot_id) instead.
-- Note: rows onboarded via the manual-token path still have
-- poster_account_number = NULL, and Postgres treats NULL as distinct from
-- NULL in unique constraints — so this composite constraint does not
-- prevent duplicate spot_ids among manually-onboarded restaurants. That's
-- an accepted tradeoff for now (manual onboarding is not yet live / is
-- human-supervised); revisit if manual onboarding becomes self-service too.
alter table restaurants drop constraint if exists restaurants_poster_spot_id_key;
alter table restaurants add constraint restaurants_account_spot_unique unique (poster_account_number, poster_spot_id);
