-- Free-tier request quota is per (Google Cloud project, model), not just per
-- project — a single API key can be metered separately for each model it calls
-- (verified 12.09.2026 in the account's own AI Studio rate-limit dashboard:
-- gemini-3.1-flash-lite and gemini-3.5-flash-lite each allow 500 requests/day,
-- while gemini-3.8-flash allows only ~20). One real key therefore becomes one
-- row PER MODEL here, sharing the same api_key value, each with its own
-- daily_limit and usage counters — see lib/gemini/models.ts for the model list.
alter table gemini_api_keys
  add column model text not null default 'gemini-3.8-flash',
  add column priority integer not null default 100;

comment on column gemini_api_keys.model is
  'Real Gemini model id this row''s quota tracks. See lib/gemini/models.ts (GEMINI_MODEL_CHAIN).';
comment on column gemini_api_keys.priority is
  'Lower is tried first when picking a key/model candidate — high-quota models get a lower number.';
