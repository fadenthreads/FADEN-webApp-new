import { createClient } from "@supabase/supabase-js";

import {
  getLocalSupabaseEnvironment,
  requireLocalValue,
} from "./supabase-local-env.mjs";

const environment = getLocalSupabaseEnvironment();
const apiUrl = requireLocalValue(environment, "API_URL");
const secretKey = requireLocalValue(
  environment,
  "SECRET_KEY",
  "SERVICE_ROLE_KEY",
);

// The seed script never opens Realtime, but Supabase still expects a transport
// constructor on Node versions that do not expose a native WebSocket.
class DisabledRealtimeTransport {}

const supabase = createClient(apiUrl, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: DisabledRealtimeTransport },
});

const localUsers = [
  {
    email: "customer@faden.local",
    password: "FadenCustomer!2026",
    name: "Mira Customer",
    role: "customer",
  },
  {
    email: "owner@faden.local",
    password: "FadenOwner!2026",
    name: "Aarya Mehta",
    role: "boutique_owner",
  },
  {
    email: "admin@faden.local",
    password: "FadenAdmin!2026",
    name: "FADEN Operator",
    role: "admin",
  },
];

const { data: existingUsers, error: listError } =
  await supabase.auth.admin.listUsers({ perPage: 1000 });
if (listError) throw listError;

for (const localUser of localUsers) {
  let user = existingUsers.users.find(
    (candidate) => candidate.email === localUser.email,
  );

  if (!user) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: localUser.email,
      password: localUser.password,
      email_confirm: true,
      user_metadata: { full_name: localUser.name },
    });
    if (error) throw error;
    user = data.user;
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ display_name: localUser.name, role: localUser.role })
    .eq("id", user.id);
  if (profileError) throw profileError;

  if (localUser.role === "boutique_owner") {
    const { data: boutique, error: boutiqueError } = await supabase
      .from("boutiques")
      .upsert(
        {
          owner_id: user.id,
          slug: "aarya-studio",
          name: "Aarya Studio",
          city: "Hyderabad",
          description: "Made-to-measure occasionwear with a modern Indian eye.",
          status: "pending_verification",
        },
        { onConflict: "slug" },
      )
      .select("id")
      .single();
    if (boutiqueError) throw boutiqueError;

    const { error: memberError } = await supabase
      .from("boutique_members")
      .upsert({
        boutique_id: boutique.id,
        user_id: user.id,
        role: "boutique_owner",
      });
    if (memberError) throw memberError;

    const { error: boutiqueProfileError } = await supabase
      .from("boutique_profiles")
      .upsert({
        boutique_id: boutique.id,
        hero_image_url:
          "https://lh3.googleusercontent.com/aida-public/AB6AXuCWJDfPXoHTLvltZX43G4Jzk0klmQX2a3L_ucgmmETl3W9KF66_saQBaAkwEPV9KAH93f67d4GbqYaHfEZzdS-vou5hNLT_YIkjkQCceC9_b618Br-RZtMQWoPVvFey9LTUAZbuL8qeqQ1zI-04hIduoS8p-lAgT4j5mhfM_nmgLi0380umV4yQ1qAhq2vPrrpkmUG19LL3ADKZkZ5ybBY4Qs-Ezp6ANdwLBnV6Jzg2D77XAuoalb8g",
        lead_time_max_weeks: 6,
        lead_time_min_weeks: 3,
        minimum_price_paise: 2500000,
        response_time_hours: 3,
        services: ["Home fitting", "Video consultation"],
        specialties: ["Occasion wear", "Hand embroidery"],
        story:
          "Aarya Studio creates modern occasionwear grounded in Indian handcraft and precise personal fittings.",
        years_experience: 9,
      });
    if (boutiqueProfileError) throw boutiqueProfileError;

    const { error: designError } = await supabase.from("designs").upsert(
      {
        base_price_paise: 3200000,
        boutique_id: boutique.id,
        description:
          "A fluid crimson silk saree finished with delicate silver threadwork.",
        lead_time_max_weeks: 5,
        lead_time_min_weeks: 3,
        materials: ["Silk"],
        occasions: ["Festive", "Evening"],
        primary_image_url:
          "https://lh3.googleusercontent.com/aida-public/AB6AXuB_6mz2MA4zktkQtDIbXTZzUxyRLP_uS7mXHTPh9tFYfWBVpbeH3KDv9y9tcLbgWc9i904G9ln1X8qffeRNg4mWpAbH7RbLB5eYU24ARorDiF69feV-lWG4I9muEbdp32XpVoRpB-wL97Diu5P4qrfgYt5Wpm0e6TDNto4ivZnTM_AWtyhnlHAcdb_qvM-vbaGLcMmv1gHakSHApH-wvbfYBcSiypT_ktAMyp3TagYQw-iw9BGsXu6D",
        slug: "aarya-crimson-silk-saree",
        status: "draft",
        techniques: ["Silver threadwork"],
        title: "Crimson Silk Saree",
      },
      { onConflict: "slug" },
    );
    if (designError) throw designError;
  }
}

console.log("Local customer, boutique owner, and admin accounts are ready.");
