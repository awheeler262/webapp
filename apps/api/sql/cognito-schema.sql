-- Manual DDL for the Cognito-approximation login (USE_COGNITO=false).
-- No migration runner exists yet (see CLAUDE.md) -- apply this by hand in
-- each environment. Creates users fresh rather than altering an existing
-- table -- run this against a database with no pre-existing users table
-- (drop it first if one exists from before this schema).

CREATE TABLE tenant (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name varchar NOT NULL
);

-- Tenant-scoped, not global -- each tenant defines its own roles.
CREATE TABLE roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenant (id),
    name varchar NOT NULL
);

CREATE TABLE users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email varchar UNIQUE NOT NULL,
    name varchar NOT NULL,
    cognito_sub uuid UNIQUE NOT NULL,
    is_devops boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE cognito (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email varchar UNIQUE NOT NULL,
    password varchar NOT NULL,
    sub uuid UNIQUE NOT NULL
);

CREATE TABLE tenant_users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users (id),
    tenant_id uuid NOT NULL REFERENCES tenant (id),
    role_id uuid NOT NULL REFERENCES roles (id)
);

CREATE TABLE invitations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenant (id),
    email varchar NOT NULL,
    role_id uuid NOT NULL REFERENCES roles (id),
    token_hash varchar NOT NULL,
    expires_at timestamptz NOT NULL,
    accepted_at timestamptz,
    invited_by uuid NOT NULL REFERENCES users (id)
);

-- Written only when a request is authorized via the is_devops path (cross-tenant
-- support access) -- not for a regular user acting in their own tenant.
CREATE TABLE devops_access_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users (id),
    tenant_id uuid NOT NULL REFERENCES tenant (id),
    role_id uuid NOT NULL REFERENCES roles (id),
    method varchar NOT NULL,
    path varchar NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
