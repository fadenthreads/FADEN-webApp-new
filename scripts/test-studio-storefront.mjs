import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import {
  studioApprovalRules,
  studioVisibility,
} from "../apps/studio/lib/studio-capabilities.mjs";

test("only verified and published boutiques are described as public", () => {
  for (const status of [
    "pending_verification",
    "rejected",
    "suspended",
    "draft",
  ])
    assert.equal(studioVisibility(status, true).live, false);
  assert.equal(studioVisibility("verified", false).live, false);
  assert.equal(studioVisibility("verified", true).live, true);
});
test("approval guide distinguishes legal review from everyday profile edits", () => {
  assert.equal(studioApprovalRules.length, 6);
  assert.match(studioApprovalRules[0].approval, /Admin approval required/);
  assert.match(
    studioApprovalRules.find((r) => r.change.includes("legal identity"))
      .approval,
    /Contact FADEN/,
  );
  assert.match(
    studioApprovalRules.find((r) => r.change.includes("Public name")).approval,
    /No repeat approval/,
  );
});

if (process.argv.includes("--database")) {
  const database = `faden_storefront_check_${Date.now()}`;
  const migration = fs.readFileSync(
    "supabase/migrations/202610260042_studio_storefront_foundation.sql",
    "utf8",
  );
  const details = JSON.stringify({
    name: "Updated Atelier",
    city: "Hyderabad",
    description: "A thoughtful bespoke atelier.",
    story:
      "A thoughtful atelier designing bespoke pieces for every special occasion.",
    specialties: ["Bridal"],
    services: ["Bespoke"],
    yearsExperience: 5,
    responseHours: 24,
    minimumPricePaise: 100000,
    leadTimeMinWeeks: 2,
    leadTimeMaxWeeks: 6,
    nextAvailableDate: null,
    heroImage: "",
  });
  execFileSync("createdb", ["-h", "127.0.0.1", database]);
  try {
    const sql = `begin;
      create role authenticated; create role anon;
      create schema auth;
      create function auth.uid() returns uuid language sql stable as 'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';
      create table public.boutiques(id uuid primary key,owner_id uuid,name text check(name<>'Break identity'),city text,description text,status text,is_published boolean default false);
      create table public.boutique_profiles(boutique_id uuid primary key,hero_image_url text,story text,specialties text[],services text[],years_experience integer,response_time_hours integer,minimum_price_paise bigint,next_available_date date,lead_time_min_weeks integer,lead_time_max_weeks integer,updated_at timestamptz not null default clock_timestamp());
      create function public.touch_profile() returns trigger language plpgsql as $$ begin new.updated_at=clock_timestamp(); return new; end $$;
      create trigger touch_profile before update on public.boutique_profiles for each row execute function public.touch_profile();
      create table public.designs(boutique_id uuid,status text,primary_image_url text);
      insert into public.boutiques(id,owner_id,name,status) values ('bb000000-0000-4000-8000-000000000001','bb000000-0000-4000-8000-000000000011','New Atelier','pending_verification'),('bb000000-0000-4000-8000-000000000002','bb000000-0000-4000-8000-000000000012','Existing Atelier','verified');
      insert into public.boutique_profiles(boutique_id,story) values('bb000000-0000-4000-8000-000000000002','Keep existing story');
      ${migration}
      do $$ begin
        if (select count(*) from public.boutique_profiles)<>2 then raise exception 'profile backfill failed'; end if;
        if (select story from public.boutique_profiles where boutique_id='bb000000-0000-4000-8000-000000000002')<>'Keep existing story' then raise exception 'backfill overwrote existing profile'; end if;
      end $$;
      insert into public.boutiques(id,owner_id,name,status) values('bb000000-0000-4000-8000-000000000003','bb000000-0000-4000-8000-000000000013','Future Atelier','pending_verification');
      do $$ begin if not exists(select 1 from public.boutique_profiles where boutique_id='bb000000-0000-4000-8000-000000000003') then raise exception 'new registration lacks profile'; end if; end $$;
      grant usage on schema public,auth to authenticated,anon;
      grant select on public.boutiques,public.boutique_profiles to authenticated,anon;
      alter table public.boutiques enable row level security;
      alter table public.boutique_profiles enable row level security;
      create policy boutique_read on public.boutiques for select using(owner_id=auth.uid() or (status='verified' and is_published));
      create policy profile_read on public.boutique_profiles for select using(exists(select 1 from public.boutiques b where b.id=boutique_id));
      select set_config('request.jwt.claim.sub','bb000000-0000-4000-8000-000000000011',true);
      set local role authenticated;
      do $$ declare v timestamptz; result jsonb; d jsonb:='${details}'; begin
        select updated_at into v from public.boutique_profiles where boutique_id='bb000000-0000-4000-8000-000000000001';
        result=public.save_boutique_storefront('bb000000-0000-4000-8000-000000000001',v,d);
        if (result->>'live')::boolean then raise exception 'pending boutique became public'; end if;
        if (select name from public.boutiques where id='bb000000-0000-4000-8000-000000000001')<>'Updated Atelier' then raise exception 'identity was not saved'; end if;
        begin perform public.save_boutique_storefront('bb000000-0000-4000-8000-000000000001',v,d); raise exception 'stale save accepted'; exception when raise_exception then if sqlerrm<>'Storefront changed; refresh before saving' then raise; end if; end;
        select updated_at into v from public.boutique_profiles where boutique_id='bb000000-0000-4000-8000-000000000001';
        begin perform public.save_boutique_storefront('bb000000-0000-4000-8000-000000000001',v,d||'{"heroImage":"foreign.jpg"}'); raise exception 'foreign cover accepted'; exception when raise_exception then if sqlerrm<>'Choose a published portfolio image as your cover' then raise; end if; end;
        begin perform public.save_boutique_storefront('bb000000-0000-4000-8000-000000000001',v,d||'{"name":"Break identity","story":"This changed story must be rolled back if the identity write fails."}'); raise exception 'identity constraint bypassed'; exception when check_violation then null; end;
        if (select story from public.boutique_profiles where boutique_id='bb000000-0000-4000-8000-000000000001')<>d->>'story' then raise exception 'profile write was not atomic'; end if;
      end $$;
      select set_config('request.jwt.claim.sub','bb000000-0000-4000-8000-000000000012',true);
      do $$ begin
        begin perform public.save_boutique_storefront('bb000000-0000-4000-8000-000000000001',now(),'${details}'); raise exception 'other owner wrote storefront'; exception when raise_exception then if sqlerrm<>'Storefront is not editable' then raise; end if; end;
      end $$;
      reset role;
      select set_config('request.jwt.claim.sub','',true);
      set local role anon;
      do $$ begin if exists(select 1 from public.boutiques where id='bb000000-0000-4000-8000-000000000001') then raise exception 'pending boutique leaked'; end if; end $$;
      reset role;
      update public.boutiques set status='verified',is_published=true where id='bb000000-0000-4000-8000-000000000001';
      set local role anon;
      do $$ begin if not exists(select 1 from public.boutique_profiles where boutique_id='bb000000-0000-4000-8000-000000000001' and story is not null) then raise exception 'approved profile not visible to customers'; end if; end $$;
      rollback;`;
    execFileSync(
      "psql",
      ["-h", "127.0.0.1", "-d", database, "-v", "ON_ERROR_STOP=1", "-q"],
      { input: sql, stdio: ["pipe", "pipe", "pipe"] },
    );
    console.log(
      "PASS isolated PostgreSQL: profile backfill/creation, private preparation, atomic save, stale/foreign-owner/cover denial, customer visibility gate",
    );
  } finally {
    execFileSync("dropdb", ["-h", "127.0.0.1", database]);
  }
}
