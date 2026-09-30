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

-- Speeds up CognitoService.findTenantIdsForUser/hasTenantUserRole, both
-- queried on every tenant-scoped request via TenantContextGuard.
CREATE INDEX tenant_users_user_id_tenant_id_idx ON tenant_users (user_id, tenant_id);

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

-- Looked up on every login attempt for an email with no cognito identity yet.
CREATE INDEX invitations_email_idx ON invitations (email);

-- One row per request. user_id/tenant_id/role_id are nullable -- not every
-- request is authenticated (e.g. the login attempt itself) or tenant-scoped.
-- is_devops distinguishes cross-tenant support access from a regular user
-- acting in their own tenant (this table replaces the earlier, narrower
-- devops_access_log).
CREATE TABLE event_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES users (id),
    tenant_id uuid REFERENCES tenant (id),
    role_id uuid REFERENCES roles (id),
    is_devops boolean NOT NULL DEFAULT false,
    method varchar NOT NULL,
    path varchar NOT NULL,
    status_code integer NOT NULL,
    ip_address inet,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Written on essentially every request (see EventLogInterceptor/
-- EventLogExceptionFilter) -- index for time-range review/retention queries.
CREATE INDEX event_log_created_at_idx ON event_log (created_at);
