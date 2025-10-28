-- Processing queue with tagging and backoff
create table if not exists public.processing_queue (
  id uuid primary key default gen_random_uuid(),
  job_type text not null, -- 'ocr' | 'validate'
  status text not null default 'queued', -- 'queued' | 'processing' | 'retrying' | 'completed' | 'failed' | 'cancelled'
  payload jsonb not null, -- arbitrary data for the worker
  case_id uuid null,
  customer_id uuid null,
  document_id uuid null,
  tags text[] default '{}', -- e.g., {doc:bank_statement, subset:applicant_1, engine:mistral}
  priority int2 not null default 5, -- 1 (highest) ... 9 (lowest)
  attempt_count int not null default 0,
  max_attempts int not null default 5,
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz null,
  locked_by text null,
  last_error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_processing_queue_status_next on public.processing_queue(status, next_attempt_at);
create index if not exists idx_processing_queue_priority on public.processing_queue(priority asc, created_at desc);
create index if not exists idx_processing_queue_tags on public.processing_queue using gin (tags);
create index if not exists idx_processing_queue_case on public.processing_queue(case_id);
create index if not exists idx_processing_queue_doc on public.processing_queue(document_id);

create or replace function public.update_timestamp()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;$$;

drop trigger if exists trg_processing_queue_updated on public.processing_queue;
create trigger trg_processing_queue_updated before update on public.processing_queue
for each row execute function public.update_timestamp();

