-- OCR + Case/Contacts baseline schema for document processing
-- Creates contacts, customers, mortgage_cases, case_contacts, documents (extended), document_validation_results

-- Contacts (individual people)
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  first_name text,
  last_name text,
  full_name text generated always as (coalesce(trim(first_name || ' ' || last_name), '')) stored,
  email text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Customers (business/customer entity if separate from contact; can link to cases)
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  customer_name text,
  email text,
  contact_id uuid references public.contacts(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Mortgage cases (one entity, support up to two applicants via case_contacts)
create table if not exists public.mortgage_cases (
  id uuid primary key default gen_random_uuid(),
  case_reference text,
  application_type text check (application_type in ('single','joint')) not null default 'single',
  customer_id uuid references public.customers(id) on delete set null,
  status text default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Link table: which contacts are applicants on a case
create table if not exists public.case_contacts (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.mortgage_cases(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  applicant_index int2 not null check (applicant_index in (1,2)),
  role text default 'applicant',
  created_at timestamptz not null default now(),
  unique(case_id, applicant_index)
);

-- Documents table: extended to support OCR
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  case_id uuid references public.mortgage_cases(id) on delete set null,
  filename text,
  file_size bigint,
  file_type text,
  storage_path text,
  document_type text not null,
  document_subset text, -- e.g., applicant_1, applicant_2, statement_1
  processing_status text default 'pending',
  extracted_data jsonb,
  ocr_provider text, -- 'mistral' | 'openai'
  ocr_confidence numeric(5,4),
  rule_set_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Validation results per document and rule
create table if not exists public.document_validation_results (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  validation_rule text not null,
  validation_status text not null, -- 'passed' | 'failed' | 'warning'
  validation_message text,
  expected_value text,
  actual_value text,
  requires_manual_review boolean default false,
  created_at timestamptz not null default now()
);

-- Rule storage (extraction + validation) with versioning
create table if not exists public.extraction_rules (
  id uuid primary key default gen_random_uuid(),
  document_type text not null,
  document_subset text,
  status text not null default 'draft', -- 'draft' | 'published'
  version text not null default 'v1',
  engine_preference text, -- 'mistral' | 'openai' | 'auto'
  fields jsonb not null,
  updated_by text,
  updated_at timestamptz not null default now()
);

create table if not exists public.validation_rules (
  id uuid primary key default gen_random_uuid(),
  document_type text not null,
  document_subset text,
  status text not null default 'draft',
  version text not null default 'v1',
  rules jsonb not null,
  updated_by text,
  updated_at timestamptz not null default now()
);

-- Helpful indexes
create index if not exists idx_documents_case_type on public.documents(case_id, document_type);
create index if not exists idx_documents_created on public.documents(created_at desc);
create index if not exists idx_case_contacts_case on public.case_contacts(case_id);
create index if not exists idx_extraction_rules_doc on public.extraction_rules(document_type, status);
create index if not exists idx_validation_rules_doc on public.validation_rules(document_type, status);

