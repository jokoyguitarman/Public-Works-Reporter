# Public Works Reporter - Database Schema Documentation

## Overview
This document tracks the complete database schema for the Public Works Reporter (PWR) system, including tables, functions, policies, and indexes.

## Database Setup

### Extensions Required
```sql
create extension if not exists postgis;
create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists pg_trgm;    -- fuzzy search on names
```

### Custom Types (Enums)
- `project_type`: 'road', 'bridge', 'building', 'drainage', 'school', 'other'
- `report_status`: 'pending', 'approved', 'rejected'
- `severity_level`: 'info', 'low', 'medium', 'high'
- `media_kind`: 'photo', 'video'

## Core Tables

### 1. Projects (`public.projects`)
**Purpose**: Canonical public works projects from DPWH/other agencies

| Column | Type | Description |
|--------|------|-------------|
| `project_id` | uuid (PK) | Primary key with auto-generated UUID |
| `name` | text | Project name (required) |
| `type` | project_type | Type of infrastructure project |
| `agency` | text | Responsible agency |
| `city` | text | City/municipality |
| `barangay` | text | Barangay/village |
| `status_official` | text | Official status (planned/ongoing/completed) |
| `budget_amount` | numeric | Project budget |
| `fund_source` | text | Source of funding |
| `start_date` | date | Project start date |
| `target_end_date` | date | Target completion date |
| `contractor` | text | Contracting company |
| `confidence` | smallint | Data confidence score (0-100, default 50) |
| `geom` | geometry | Spatial geometry (SRID 4326) |
| `raw` | jsonb | Original source attributes |
| `created_at` | timestamptz | Record creation timestamp |
| `updated_at` | timestamptz | Last update timestamp |

### 2. Project Sources (`public.project_sources`)
**Purpose**: Traceability for each project record

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigserial (PK) | Auto-incrementing primary key |
| `project_id` | uuid (FK) | References projects.project_id |
| `source` | text | Source system (dpwh_agol, philgeps, fdp, manual) |
| `source_record_id` | text | Original record ID from source |
| `match_method` | text | How record was matched (exact/fuzzy/manual) |
| `score` | numeric | Match confidence score |
| `raw` | jsonb | Original source data |
| `ingested_at` | timestamptz | Import timestamp |

### 3. Reports (`public.reports`)
**Purpose**: Anonymous citizen reports

| Column | Type | Description |
|--------|------|-------------|
| `report_id` | uuid (PK) | Primary key with auto-generated UUID |
| `project_id` | uuid (FK) | Optional link to project |
| `geom` | geometry(Point, 4326) | Observation location |
| `text` | text | Report description |
| `status` | report_status | pending/approved/rejected (default: pending) |
| `severity` | severity_level | Info/low/medium/high |
| `device_pid` | uuid | Client-generated device ID for rate limiting |
| `submitted_at` | timestamptz | Submission timestamp |
| `moderated_at` | timestamptz | Moderation timestamp |
| `moderator_note` | text | Moderator comments |

**Constraints**: Either `project_id` or `geom` must be non-null

### 4. Report Media (`public.report_media`)
**Purpose**: Photo/video attachments for reports

| Column | Type | Description |
|--------|------|-------------|
| `media_id` | uuid (PK) | Primary key with auto-generated UUID |
| `report_id` | uuid (FK) | References reports.report_id |
| `kind` | media_kind | photo or video |
| `storage_path` | text | Object storage path |
| `width` | int | Media width in pixels |
| `height` | int | Media height in pixels |
| `duration_ms` | int | Video duration in milliseconds |
| `created_at` | timestamptz | Upload timestamp |

### 5. Report Flags (`public.report_flags`)
**Purpose**: Community moderation signals

| Column | Type | Description |
|--------|------|-------------|
| `flag_id` | bigserial (PK) | Auto-incrementing primary key |
| `report_id` | uuid (FK) | References reports.report_id |
| `reason` | text | Flag reason |
| `created_at` | timestamptz | Flag timestamp |

### 6. Subscriptions (`public.subscriptions`)
**Purpose**: Proximity alerts for projects

| Column | Type | Description |
|--------|------|-------------|
| `subscription_id` | uuid (PK) | Primary key with auto-generated UUID |
| `user_id` | uuid | Future: authenticated user ID |
| `device_pid` | uuid | Anonymous device ID |
| `project_id` | uuid (FK) | References projects.project_id |
| `radius_m` | int | Alert radius in meters (default: 200) |
| `created_at` | timestamptz | Subscription timestamp |

**Constraints**: Either `user_id` or `device_pid` must be non-null

### 7. Audit Log (`public.audit_log`)
**Purpose**: Track all system changes

| Column | Type | Description |
|--------|------|-------------|
| `audit_id` | bigserial (PK) | Auto-incrementing primary key |
| `entity` | text | Table name affected |
| `entity_id` | text | ID of affected record |
| `action` | text | Action type (insert/update/delete/moderate/import) |
| `actor` | text | User/system performing action |
| `before` | jsonb | Previous state |
| `after` | jsonb | New state |
| `created_at` | timestamptz | Action timestamp |

### 8. Profiles (`public.profiles`)
**Purpose**: Link Supabase users to roles

| Column | Type | Description |
|--------|------|-------------|
| `user_id` | uuid (PK) | References auth.users(id) |
| `full_name` | text | User's full name |
| `role` | text | admin/moderator/viewer |
| `created_at` | timestamptz | Profile creation timestamp |

## Helper Functions

### User Role Functions
```sql
-- Get current user ID
create or replace function public.current_user_id()
returns uuid language sql stable as $$
  select auth.uid()
$$;

-- Check if user is admin
create or replace function public.is_admin()
returns boolean language sql stable as $$
  select exists (select 1 from public.profiles where user_id = auth.uid() and role = 'admin')
$$;

-- Check if user is moderator (or admin)
create or replace function public.is_moderator()
returns boolean language sql stable as $$
  select exists (select 1 from public.profiles where user_id = auth.uid() and role in ('admin','moderator'))
$$;
```

### Utility Functions
```sql
-- Set updated_at timestamp
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end
$$;

-- Find nearby projects
create or replace function public.nearby_projects(lat double precision, lng double precision, meters integer default 500)
returns table (
  project_id uuid,
  name text,
  type project_type,
  status_official text,
  distance_m double precision,
  geom geometry
) language sql stable as $$
  -- Implementation returns up to 100 projects within specified radius
$$;

-- Approve a report
create or replace function public.approve_report(p_report_id uuid, p_actor text default null)
returns void language plpgsql security definer as $$
  -- Implementation updates report status and logs audit trail
$$;
```

## Indexes

### Spatial Indexes
- `idx_projects_geom` - GIST index on projects.geom
- `idx_reports_geom` - GIST index on reports.geom
- `idx_projects_centroids_center` - GIST index on materialized view centroids

### Performance Indexes
- `idx_projects_city` - B-tree index on projects.city
- `idx_projects_name_trgm` - GIN trigram index for fuzzy name search
- `idx_sources_project` - B-tree index on project_sources.project_id
- `idx_reports_project` - B-tree index on reports.project_id
- `idx_reports_status` - B-tree index on reports.status
- `idx_media_report` - B-tree index on report_media.report_id
- `idx_flags_report` - B-tree index on report_flags.report_id
- `idx_profiles_role` - B-tree index on profiles.role

## Materialized Views

### Projects Centroids (`public.projects_centroids`)
**Purpose**: Fast nearby project lookups using centroids

```sql
create materialized view public.projects_centroids as
select
  project_id,
  name,
  type,
  status_official,
  case
    when geometrytype(geom) = 'POINT' then geom
    when geom is not null then st_centroid(geom)
    else null
  end as center
from public.projects
where geom is not null;
```

## Row Level Security (RLS) Policies

### Projects
- **Public Read**: All users can read projects
- **Admin Management**: Only admins can insert/update/delete projects

### Reports
- **Public Insert**: Anyone can submit reports (status defaults to pending)
- **Public Read**: Only approved reports visible to public
- **Staff Read**: Moderators/admins can read all reports
- **Staff Update**: Moderators/admins can approve/reject reports

### Report Media
- **Public Insert**: Anyone can upload media for existing reports
- **Public Read**: Only media for approved reports visible to public
- **Staff Read**: Moderators/admins can read all media

### Report Flags
- **Public Insert**: Anyone can flag reports
- **Staff Read**: Moderators/admins can read all flags

## Triggers

### Updated At Trigger
```sql
-- Automatically update updated_at timestamp on projects table
create trigger trg_projects_updated_at
before update on public.projects
for each row execute function public.tg_set_updated_at();
```

## Data Refresh Functions

### Projects Centroids Refresh
```sql
create or replace function public.refresh_projects_centroids()
returns void language sql as $$
  refresh materialized view concurrently public.projects_centroids;
$$;
```

## Table Comments
- Projects: "Canonical public works projects (DPWH/LGU/etc.). Geometry can be point/line/polygon in SRID 4326."
- Reports: "Anonymous citizen reports. Default status=pending; only approved reports are visible to the public."
- Nearby Projects Function: "Return up to 100 projects within :meters of (:lat,:lng), ordered by distance."

---

## Schema Version History

### v1.0 (Initial)
- Complete database schema with all core tables
- Row Level Security policies implemented
- Spatial indexing for geographic queries
- Audit logging system
- Materialized views for performance
- Helper functions for user roles and utilities

---

*This schema provides a robust foundation for the Public Works Reporter system, supporting anonymous reporting, content moderation, and administrative oversight while maintaining data integrity and performance.*
