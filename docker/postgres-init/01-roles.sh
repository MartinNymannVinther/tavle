#!/bin/bash
# Creates the two runtime database roles at cluster initialization.
#
# - tavle_app:  the application role for all domain queries, fully subject to RLS
# - tavle_auth: the role Better Auth uses; only granted access to auth tables
#
# Passwords come from the environment (see docker-compose files). Migrations
# create the roles as NOLOGIN if they are missing, so this script only needs to
# guarantee LOGIN + password. It is idempotent.
#
# Two things are deliberate here. The passwords are required rather than
# defaulted: a fallback of "the role name as its own password" is worse
# than a failure, because it works. And they are passed to psql as
# variables and quoted with format(%L) inside the DO block rather than
# pasted into SQL by the shell, so a password containing a quote breaks
# nothing and injects nothing. scripts/ensure-roles.ts does the same and
# says why.
set -euo pipefail

: "${TAVLE_APP_PASSWORD:?set TAVLE_APP_PASSWORD}"
: "${TAVLE_AUTH_PASSWORD:?set TAVLE_AUTH_PASSWORD}"

psql -v ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v app_pw="$TAVLE_APP_PASSWORD" -v auth_pw="$TAVLE_AUTH_PASSWORD" <<'EOSQL'
  DO $$
  DECLARE
    v_app_pw text := :'app_pw';
    v_auth_pw text := :'auth_pw';
  BEGIN
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'tavle_app') THEN
      EXECUTE format('ALTER ROLE tavle_app LOGIN PASSWORD %L', v_app_pw);
    ELSE
      EXECUTE format('CREATE ROLE tavle_app LOGIN PASSWORD %L', v_app_pw);
    END IF;

    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'tavle_auth') THEN
      EXECUTE format('ALTER ROLE tavle_auth LOGIN PASSWORD %L', v_auth_pw);
    ELSE
      EXECUTE format('CREATE ROLE tavle_auth LOGIN PASSWORD %L', v_auth_pw);
    END IF;
  END
  $$;
EOSQL
