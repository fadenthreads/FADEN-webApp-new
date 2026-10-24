import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import ts from "typescript";

const compiled = ts.transpileModule(
  fs.readFileSync("apps/marketplace/lib/outfit-request.ts", "utf8"),
  {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  },
).outputText;
const module = { exports: {} };
new Function("exports", compiled)(module.exports);
const { validateDraft, EMPTY_DRAFT } = module.exports;
const key =
  "aa000000-0000-4000-8000-000000000001/aa000000-0000-4000-8000-000000000002/aa000000-0000-4000-8000-000000000003.jpg";
const draft = {
  ...EMPTY_DRAFT,
  measurementMethod: "reference",
  measurements: { ...EMPTY_DRAFT.measurements, reference: key },
};
assert.equal(validateDraft(draft).measurements.reference, key);
assert.equal(validateDraft({}).measurements.reference, "");
assert.throws(() =>
  validateDraft({
    ...draft,
    measurements: {
      ...draft.measurements,
      reference: "https://example.com/signed?token=secret",
    },
  }),
);
assert.throws(
  () =>
    validateDraft(
      {
        ...draft,
        occasion: "Wedding",
        garment: "Dress",
        expert: true,
        measurements: { ...draft.measurements, reference: "" },
      },
      true,
    ),
  /Upload your measurement chart/,
);
console.log(
  "PASS draft reference persistence, legacy compatibility, signed URL rejection, missing-chart validation",
);

// Optional native PostgreSQL check: isolated schema fixtures, no Docker or hosted writes.
if (process.argv.includes("--rls")) {
  const database = `faden_measurement_check_${Date.now()}`;
  execFileSync("createdb", ["-h", "127.0.0.1", database]);
  try {
    const migration = fs.readFileSync(
      "supabase/migrations/202610240040_measurement_references.sql",
      "utf8",
    );
    const expansion = fs.readFileSync(
      "supabase/migrations/202610240041_request_flow_expansion.sql",
      "utf8",
    );
    const sql = `begin;
      create role authenticated;
      create schema auth; create schema storage;
      create function auth.uid() returns uuid language sql stable as 'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';
      create table public.outfit_requests(id uuid, user_id uuid, status text default 'draft', draft jsonb, version integer default 1, submitted_at timestamptz);
      create table public.request_shares(id uuid default gen_random_uuid(),customer_id uuid, request_id uuid, boutique_id uuid, brief jsonb, include_measurements boolean, revoked_at timestamptz, client_label text, include_inspiration boolean default false);
      create table public.outbox_events(event_type text,aggregate_type text,aggregate_id text,payload jsonb);
      create table public.profiles(id uuid,display_name text);
      create table public.boutiques(id uuid,owner_id uuid,status text,is_published boolean);
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(bucket_id text,name text);
      alter table storage.objects enable row level security;
      grant usage on schema public,auth,storage to authenticated;
      grant select,insert,delete on storage.objects to authenticated;
      grant select on public.request_shares to authenticated;
      create function public.can_write_request_inspiration(object_name text) returns boolean language sql stable security definer set search_path='' as $$
        select split_part(object_name,'/',1)=auth.uid()::text and exists(select 1 from public.outfit_requests where id::text=split_part(object_name,'/',2) and user_id=auth.uid())
      $$;
      create function public.owns_verified_atelier(id uuid) returns boolean language sql stable as $$ select id=auth.uid() $$;
      ${migration}
      ${expansion}
      insert into public.outfit_requests(id,user_id) values ('aa000000-0000-4000-8000-000000000002','aa000000-0000-4000-8000-000000000001');
      insert into public.request_shares(customer_id,request_id,boutique_id,brief,include_measurements,revoked_at) values ('aa000000-0000-4000-8000-000000000001','aa000000-0000-4000-8000-000000000002','aa000000-0000-4000-8000-000000000004','{"measurements":{"reference":"${key}"}}',false,null);
      set local role authenticated;
      select set_config('request.jwt.claim.sub','aa000000-0000-4000-8000-000000000001',true);
      insert into storage.objects values ('request-measurements','${key}');
      do $$ begin if (select count(*) from storage.objects)<>1 then raise exception 'owner read denied'; end if; end $$;
      select set_config('request.jwt.claim.sub','aa000000-0000-4000-8000-000000000004',true);
      do $$ begin if (select count(*) from storage.objects)<>0 then raise exception 'chart leaked without measurement consent'; end if; end $$;
      reset role;
      update public.request_shares set include_measurements=true;
      set local role authenticated;
      do $$ begin if (select count(*) from storage.objects)<>1 then raise exception 'consented boutique read denied'; end if; end $$;
      select set_config('request.jwt.claim.sub','aa000000-0000-4000-8000-000000000005',true);
      do $$ begin
        if (select count(*) from storage.objects)<>0 then raise exception 'unrelated user read allowed'; end if;
        begin insert into storage.objects values ('request-measurements','${key}'); raise exception 'unrelated user write allowed'; exception when insufficient_privilege then null; end;
      end $$;
      reset role;
      update public.request_shares set revoked_at=now();
      set local role authenticated;
      select set_config('request.jwt.claim.sub','aa000000-0000-4000-8000-000000000004',true);
      do $$ begin if (select count(*) from storage.objects)<>0 then raise exception 'revoked boutique read allowed'; end if; end $$;
      reset role;
      insert into public.outfit_requests(id,user_id,draft) values ('aa000000-0000-4000-8000-000000000006','aa000000-0000-4000-8000-000000000001','{"occasion":"Sangeet","garment":"Blouse","expert":false,"silhouette":"Custom Form","customSilhouette":"Peplum shape","neckline":"Custom / Other","necklineNotes":"My own shape","sleeves":"Cap Sleeve","budget":"10k_25k","eventDate":"2099-12-31","deliveryDate":"2099-12-01","measurementMethod":"manual","measurements":{"unit":"cm","chest":"86","sleeveLength":"24"},"consent":true}');
      insert into public.profiles values ('aa000000-0000-4000-8000-000000000001','Test customer');
      insert into public.boutiques values ('aa000000-0000-4000-8000-000000000007','aa000000-0000-4000-8000-000000000007','verified',true);
      set local role authenticated;
      select set_config('request.jwt.claim.sub','aa000000-0000-4000-8000-000000000001',true);
      select public.submit_outfit_request('aa000000-0000-4000-8000-000000000006',1);
      select public.share_outfit_request('aa000000-0000-4000-8000-000000000006','aa000000-0000-4000-8000-000000000007',false,false,true);
      reset role;
      do $$ declare b jsonb; begin
        if not exists(select 1 from public.outfit_requests where id='aa000000-0000-4000-8000-000000000006' and status='submitted') then raise exception 'blouse submission failed'; end if;
        select brief into b from public.request_shares where request_id='aa000000-0000-4000-8000-000000000006';
        if b->>'customSilhouette'<>'Peplum shape' or b->>'necklineNotes'<>'My own shape' then raise exception 'custom style details not shared'; end if;
        if b ? 'measurements' then raise exception 'measurements shared without consent'; end if;
      end $$;
      rollback;`;
    execFileSync(
      "psql",
      ["-h", "127.0.0.1", "-d", database, "-v", "ON_ERROR_STOP=1", "-q"],
      { input: sql, stdio: ["pipe", "pipe", "pipe"] },
    );
    console.log(
      "PASS isolated PostgreSQL migration/RLS: chart privacy, garment-specific submission, custom details in share snapshots, measurement consent",
    );
  } finally {
    execFileSync("dropdb", ["-h", "127.0.0.1", database]);
  }
}
