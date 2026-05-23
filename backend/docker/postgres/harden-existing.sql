-- Hardening for existing PostgreSQL (safe to re-run).
-- Does NOT modify betting/line/live data or schema.

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO PUBLIC;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'onex_app') THEN
    CREATE ROLE onex_app WITH
      LOGIN
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOINHERIT
      CONNECTION LIMIT 80;
  END IF;
END
$$;

GRANT CONNECT ON DATABASE onex TO onex_app;
GRANT USAGE ON SCHEMA public TO onex_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO onex_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO onex_app;

ALTER DEFAULT PRIVILEGES FOR ROLE onex IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO onex_app;
ALTER DEFAULT PRIVILEGES FOR ROLE onex IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO onex_app;

ALTER ROLE onex_app SET statement_timeout = '30s';
ALTER ROLE onex_app SET idle_in_transaction_session_timeout = '60s';
