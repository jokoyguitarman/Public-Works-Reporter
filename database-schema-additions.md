# Public Works Reporter - Database Schema Additions

## Overview
This document tracks additional database schema enhancements for the Public Works Reporter (PWR) system, including materials tracking, condition ratings, and flexible metadata support.

## Schema Additions

### New Enum Types

#### Condition Rating (`condition_rating`)
```sql
create type condition_rating as enum ('unknown','good','fair','poor','failed');
```

**Purpose**: Standardized condition assessment for both official and observed infrastructure states.

## Enhanced Tables

### 1. Projects Table Additions

#### New Columns Added to `public.projects`

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `primary_material` | text | null | Official primary material (e.g., asphalt, concrete, steel) |
| `design_type` | text | null | Official design type (e.g., PCC/AC for roads; girder/slab/arch for bridges) |
| `condition_official` | condition_rating | 'unknown' | Official condition rating from agency |
| `last_inspected_at` | date | null | Date of last official inspection |
| `length_m` | numeric | null | Project length in meters |
| `width_m` | numeric | null | Project width in meters |
| `lanes` | smallint | null | Number of lanes |
| `year_built` | smallint | null | Year of construction |
| `tech_specs` | jsonb | null | Flexible official technical attributes |

#### New Indexes
- `idx_projects_condition_official` - B-tree index on condition_official
- `idx_projects_primary_material` - B-tree index on primary_material

### 2. Reports Table Additions

#### New Columns Added to `public.reports`

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `observed_condition` | condition_rating | 'unknown' | Citizen-observed condition rating |
| `observed_materials` | text[] | '{}' | Citizen-observed materials (array) |
| `observed_hazards` | text[] | '{}' | Citizen-observed hazards (array) |
| `observed_at` | timestamptz | null | When observation occurred (if different from submit time) |
| `photo_count` | int | 0 | Number of photos attached |
| `observed_meta` | jsonb | null | Flexible per-report metadata |

#### New Indexes
- `idx_reports_observed_condition` - B-tree index on observed_condition

### 3. New Table: Attribute Definitions (`public.attribute_defs`)

**Purpose**: Dictionary of flexible attributes used in projects.tech_specs and reports.observed_meta

| Column | Type | Description |
|--------|------|-------------|
| `key` | text (PK) | Canonical key (e.g., 'pavement_type') |
| `label` | text | Human-readable label |
| `scope` | text | Where used ('project' or 'report') |
| `datatype` | text | Data type ('text', 'number', 'boolean', 'date', 'enum', 'json') |
| `allowed_values` | text[] | Valid values for enum types |
| `units` | text | Measurement units (e.g., 'm', 'm²', 'MPa') |
| `required` | boolean | Whether field is required (default: false) |
| `help_text` | text | User guidance text |
| `created_at` | timestamptz | Creation timestamp |

#### Sample Attribute Definitions
```sql
-- Pavement types for road projects
('pavement_type', 'Pavement Type', 'project', 'enum', 
 array['asphalt','concrete','gravel','earth'], null, false, 
 'Surface type for roadway segments.')

-- Bridge deck materials
('bridge_deck_material', 'Bridge Deck Material', 'project', 'enum', 
 array['rc','pc','steel','timber'], null, false, 
 'RC=reinforced concrete, PC=prestressed concrete.')

-- Safety observations
('lane_markings', 'Lane Markings Present', 'report', 'boolean', 
 null, null, false, 'Did you observe lane markings?')

('signage_adequate', 'Signage Adequate', 'report', 'boolean', 
 null, null, false, 'Are safety/DPWH signboards present and visible?')

('hazard_notes', 'Hazard Notes', 'report', 'text', 
 null, null, false, 'Additional hazard context (e.g., open trench, no PPE).')
```

## New Views

### Condition Comparison View (`public.v_condition_comparison`)

**Purpose**: Compare official vs observed condition ratings

```sql
create view public.v_condition_comparison as
select
  p.project_id,
  p.name,
  p.condition_official,
  r.observed_condition,
  r.submitted_at,
  r.report_id
from public.projects p
left join public.reports r
  on r.project_id = p.project_id
where r.status = 'approved';
```

**Use Cases**:
- Identify discrepancies between official and observed conditions
- Track condition changes over time
- Generate analytics reports
- Validate official condition assessments

## New Functions

### Array Normalization Function
```sql
create or replace function public._trim_text_array(text[]) 
returns text[] language sql immutable as $$
  select coalesce(array_agg(nullif(btrim(x), '')), '{}')
  from unnest($1) as t(x)
$$;
```

**Purpose**: Clean and normalize text arrays by trimming whitespace and removing empty elements.

## New Triggers

### Report Array Normalization Trigger
```sql
create or replace function public.tg_normalize_report_arrays()
returns trigger language plpgsql as $$
begin
  if new.observed_materials is not null then
    new.observed_materials := public._trim_text_array(new.observed_materials);
  end if;
  if new.observed_hazards is not null then
    new.observed_hazards := public._trim_text_array(new.observed_hazards);
  end if;
  return new;
end
$$;

create trigger trg_reports_normalize_arrays
before insert or update on public.reports
for each row execute function public.tg_normalize_report_arrays();
```

**Purpose**: Automatically clean and normalize array fields when reports are created or updated.

## Enhanced Data Model Benefits

### 1. **Rich Condition Tracking**
- Official condition ratings from agencies
- Citizen-observed condition assessments
- Historical condition comparison capabilities

### 2. **Material and Design Documentation**
- Primary materials tracking (asphalt, concrete, steel)
- Design type specifications
- Technical specifications in flexible JSON format

### 3. **Hazard and Safety Reporting**
- Structured hazard identification
- Safety observation tracking
- Community safety monitoring

### 4. **Flexible Metadata System**
- Extensible attribute definitions
- UI guidance for data entry
- Validation rules for different data types
- Support for both project and report metadata

### 5. **Analytics and Reporting**
- Condition comparison views
- Material usage analytics
- Hazard trend analysis
- Performance metrics

## Usage Examples

### Query Projects by Material
```sql
SELECT name, primary_material, condition_official 
FROM projects 
WHERE primary_material = 'asphalt' 
AND condition_official = 'poor';
```

### Find Reports with Specific Hazards
```sql
SELECT r.*, p.name as project_name
FROM reports r
JOIN projects p ON r.project_id = p.project_id
WHERE 'open_trench' = ANY(r.observed_hazards)
AND r.status = 'approved';
```

### Compare Official vs Observed Conditions
```sql
SELECT 
  project_id,
  name,
  condition_official,
  observed_condition,
  CASE 
    WHEN condition_official = observed_condition THEN 'match'
    WHEN condition_official::text < observed_condition::text THEN 'observed_worse'
    ELSE 'observed_better'
  END as comparison
FROM v_condition_comparison
WHERE observed_condition IS NOT NULL;
```

## Migration Notes

### Installation Order
1. Run the base schema first
2. Apply this additive patch
3. Verify all constraints and indexes are created
4. Test the new functionality

### Data Validation
- Ensure condition ratings are properly mapped from existing data
- Validate material types against expected values
- Check array fields for proper formatting

### Performance Considerations
- New indexes may impact write performance
- Consider partitioning for large datasets
- Monitor query performance on condition comparisons

---

## Schema Version History

### v1.1 (Additive Patch)
- Added condition rating system
- Enhanced projects table with technical specifications
- Added flexible metadata support
- Implemented hazard and material tracking
- Created attribute definition system
- Added condition comparison analytics

---

*These additions significantly enhance the Public Works Reporter's capability to track detailed infrastructure conditions, materials, and safety observations while maintaining flexibility for future requirements.*
