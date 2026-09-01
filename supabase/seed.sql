insert into public.boutiques (slug, name, description, city, status, is_published)
values (
  'studio-vanya',
  'Studio Vanya',
  'Experimental silhouettes, considered materials, and custom pieces shaped around the wearer.',
  'Hyderabad',
  'verified',
  true
)
on conflict (slug) do nothing;

insert into public.boutiques (slug, name, description, city, status, is_published)
values
  ('the-loom-house', 'The Loom House', 'Minimalist contemporary silhouettes crafted from organic linens.', 'Hyderabad', 'verified', true),
  ('studio-kalt', 'Studio Kalt', 'Architectural tailoring with an experimental, modern point of view.', 'Bengaluru', 'verified', true),
  ('atelier-nysa', 'Atelier Nysa', 'Fluid occasionwear shaped by handwork and responsible materials.', 'Mumbai', 'verified', true)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  city = excluded.city,
  status = excluded.status,
  is_published = excluded.is_published;

insert into public.boutique_profiles (
  boutique_id, hero_image_url, story_image_url, story, specialties, services,
  years_experience, response_time_hours, next_available_date,
  minimum_price_paise, lead_time_min_weeks, lead_time_max_weeks, rating, review_count
)
values
  (
    (select id from public.boutiques where slug = 'studio-vanya'),
    'https://lh3.googleusercontent.com/aida-public/AB6AXuDZd0dgOacmsq7ItFu__GfGs4GdTW1F3d1C4k8kG4EddfHJ8G5oaIfJ-mKGX1ikcYw8Rk6TmsmW60-kc7YawrshTI433YQCHij3F2G44ofvJu1utdkIKN6GflGMULTWJSG8gD0HtzeZiX0FETXXRnodHAm8uJxKAdyn8JvymeSrRI5-f6Ka9yborzRwZv3bdQAVym2mQNpfRq00Ha0Y2IJRxnVV5hUxwZswJ91P_bCygO4DZwnCIKMF',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuBCKUo2smDgJIOKy7rhwm5zv-USNgC9_bAA_Rg_HsWfaUQsTqTa-ta3FXBSTHVfFL84FVmeAZFtPKlOSdQonjm1xouIsPZepOK90NA__YFbtgRw0spkrAUwttmVbfp6cmhyhTD6wqUFpHNGKixfW4R7Hl_DDov3uYmvDDirr9V8XFbtPbiCZcBtJ_JZHWIi5BsYe42VzSe4kMt13eRfjoc_1dqld51u_O27tGfYBQZ7FACbdsufUWyF',
    'Studio Vanya is a celebration of artisanal craftsmanship and modern silhouettes. For over 12 years, the atelier has crafted bespoke luxury wear that honours the heritage of Indian textiles while exploring contemporary form.',
    array['Hand embroidery', 'Zardosi', 'Custom draping'],
    array['Home fitting', 'Video consultation'],
    12, 2, current_date + 7, 2500000, 3, 5, 4.9, 128
  ),
  (
    (select id from public.boutiques where slug = 'the-loom-house'),
    'https://lh3.googleusercontent.com/aida-public/AB6AXuDGc7VaK19Hfg6AxagBoGQZa-rJ2szXTGH9SVZUylri_2zMWnDHqKKRGGHbPokpyjB0BpYREHuZocZYy-aO1dLKDl6x4mHWVHuaen6ZAqRqUuRTouLL2jFfcvgb1lfDeowrFiyHOe7lhGfTp0Rv19bhyryX2uRS3Eu5y3WVmSgeVN5WdVlvUClZdZgeLeBoSSPY4TRDRjkjCdTzL3PxtdbSPJdNJ9I12WrgsV0NU_bbApoNdfP1RZUF',
    null,
    'The Loom House creates quiet, modern garments from traceable natural fibres, balancing generous proportions with exacting construction.',
    array['Natural dyeing', 'Contemporary tailoring'],
    array['Rush orders', 'Video consultation'],
    8, 4, current_date + 12, 1200000, 1, 2, 4.7, 84
  ),
  (
    (select id from public.boutiques where slug = 'studio-kalt'),
    'https://lh3.googleusercontent.com/aida-public/AB6AXuCjEFkVm1FPQf8haQhs5ApO5RY5yKmsm1QWr7Kq4yHv_D3PsrLJ0BaPUgImFv1iuhca2Axk6T9F7Zdq2gqNsRz89vOFvCjbl08vt9_XVH3TqfcfZwnkfSmv4WdBjv4KZorA3-3jB2Ki9pvT764jwXODho5n5Cy9qwr91D5H0opH4-laPLzZEpVAZMUIVFWo52HoxVYc4YYud5DN5cu3-RGr2wkYEbisXJ3sAVSQdYFjZsxl-8RY3yH2',
    null,
    'Studio Kalt approaches clothing as architecture, building strong silhouettes that remain responsive to the wearer.',
    array['Architectural tailoring', 'Experimental draping'],
    array['Video consultation'],
    6, 6, current_date + 15, 2800000, 3, 6, 4.8, 62
  ),
  (
    (select id from public.boutiques where slug = 'atelier-nysa'),
    'https://lh3.googleusercontent.com/aida-public/AB6AXuC8p0h2gfOIXWKQq4NYzooRO7o-l3B8avh2hpC5KiCx532bv2G4iF_h-7uY5Dlyeewi92wMltPk-7D3ttfdKUSUaYY2wHoxtM8zTJkKRHscLdVljZjK0J8JbZf6siPJmzADFjWnBi23wBxWO_H9FONaqZvpTPqn56rw1ceJdGWgrSXv8hBomvdNosN4xRwPDYkOLBxudaxqeKSPpAYN7uhzrm3ezwpiyMdoBV6HyzwNy9DQwrpqeeeJ',
    null,
    'Atelier Nysa explores fluid occasionwear through responsible textiles and low-waste cutting systems.',
    array['Fluid tailoring', 'Zero-waste cutting'],
    array['Home fitting', 'Video consultation'],
    7, 5, current_date + 10, 1800000, 2, 4, 4.6, 51
  )
on conflict (boutique_id) do update set
  hero_image_url = excluded.hero_image_url,
  story_image_url = excluded.story_image_url,
  story = excluded.story,
  specialties = excluded.specialties,
  services = excluded.services,
  years_experience = excluded.years_experience,
  response_time_hours = excluded.response_time_hours,
  next_available_date = excluded.next_available_date,
  minimum_price_paise = excluded.minimum_price_paise,
  lead_time_min_weeks = excluded.lead_time_min_weeks,
  lead_time_max_weeks = excluded.lead_time_max_weeks,
  rating = excluded.rating,
  review_count = excluded.review_count;

insert into public.designs (
  boutique_id, slug, title, description, status, base_price_paise,
  lead_time_min_weeks, lead_time_max_weeks, primary_image_url,
  gallery_image_urls, occasions, materials, techniques,
  customizable_elements, tags, is_featured, published_at
)
values
  (
    (select id from public.boutiques where slug = 'studio-vanya'),
    'antique-gold-zardosi-lehenga', 'Antique Gold Zardosi Lehenga',
    'A reimagined classic rendered in antique gold on pure silk, designed as a foundation for your bespoke vision.',
    'published', 4500000, 4, 6,
    'https://lh3.googleusercontent.com/aida-public/AB6AXuBIi_MPdMsoWpoCBrNeh4IkgJIdDQZW04O-hTgyphtOrns8pLX-AeKrMpSmzUgJoNvvmAOBrL89tdiOR-vNMgdYyw3xtey2iPNuixgsY9BKcP8BbgVYjb_2if4e4Uwlv4960k6a5tCeLQUk7I81S8P4UBIEcd712Bk2eE0ghgUoTkeDGaLuYpEcobu3M9lFIhqsO33XzDuSnCQ1MxmS76GkLpvrGiSLnhYdgNcA9z5_S82vVREA_pIq',
    array[
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCSGRwxWUqan6hHDXktJw8ui3fRUW7U3B206IQJsZEK4_dPD8VATaXhPrehT_Fa4B7ptWycirL7W_HQfCbQIdLiIJcKX1WTckSjmkYv0blz3kFKSqMkrGnCUrOVpcbrssWZIrElp2gH2-g1KAz5WGebbx3wmbXoYp5N-nwuwKKdATPz-FF7o0vj8o-eZfq_Qnsx9vmHDlpdGozl_kTjO3iHEoO-C3gt_tiC_vSonRSs_CbYDK5Kt7sC',
      'https://lh3.googleusercontent.com/aida-public/AB6AXuA4zkFt5bD8X541VIAZC1BRwsNZtHrJb3d1bVDaylKAOU6i1WpT8hcLIEhlbga8Us2OoJend4w5glIHiSc5uAMzKmLBAGmpq8z-3m9c7IzBYPxPkxOoXXmQaQbYxTuxq66rekG6ThvrXKyKpeTGibkClt8j7QnuJM3CnstqMZiYZ-I9D4EEf2awTZTAbAhYhIcVpn61SZtcXHDWueQKRuFwWfKMIoUMzVqm0f8w8uHiVbBDtp5mNBIV',
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDachS1b9CJNbPRtk001OfIg2T5yV_Eyce6-qaVwu-0eGz6PcpdG7Z8oO8KXosHatZtsgQ3jY8lnF1QcoKTNBloeXNYZVEt454Csa7exhW-zEp7-jEgFlhskUMPQMhg-ZNsHuvvEhFsah1QRpE2qm6P6VTi_PZw_GlKwIdjXK5Mh4j9mGmcvezMg-DHQNjzpZpT4cBwlcnRbflL73pBzf1Fi3Ko2H0v-R6rJofqQGVZNsFXN7mnGXNI'
    ],
    array['Wedding', 'Bridal'], array['Silk'], array['Zardosi', 'Hand embroidery'],
    array['Base colour palette', 'Blouse neckline and silhouette', 'Sleeve length and detail'],
    array['lehenga', 'gold', 'bridal'], true, now()
  ),
  (
    (select id from public.boutiques where slug = 'studio-kalt'),
    'terracotta-silk-form', 'Terracotta Silk Form',
    'An asymmetrically draped silk gown with a sculptural, fluid silhouette.',
    'published', 3800000, 4, 6,
    'https://lh3.googleusercontent.com/aida-public/AB6AXuCjEFkVm1FPQf8haQhs5ApO5RY5yKmsm1QWr7Kq4yHv_D3PsrLJ0BaPUgImFv1iuhca2Axk6T9F7Zdq2gqNsRz89vOFvCjbl08vt9_XVH3TqfcfZwnkfSmv4WdBjv4KZorA3-3jB2Ki9pvT764jwXODho5n5Cy9qwr91D5H0opH4-laPLzZEpVAZMUIVFWo52HoxVYc4YYud5DN5cu3-RGr2wkYEbisXJ3sAVSQdYFjZsxl-8RY3yH2',
    '{}', array['Evening', 'Festive'], array['Silk'], array['Draping'],
    array['Colour', 'Hem length'], array['gown', 'terracotta'], true, now()
  ),
  (
    (select id from public.boutiques where slug = 'the-loom-house'),
    'architectural-wool-blazer', 'Architectural Wool Blazer',
    'A charcoal wool blazer with an oversized lapel and geometric ivory lining.',
    'published', 2800000, 3, 5,
    'https://lh3.googleusercontent.com/aida-public/AB6AXuBtfkT5fYGsbXzK_VZ0R44drXh0hqzMO-_P_4rTVmc9ECe5Ua-tMlWVCRQ_YBlI5igqpLw1X2u4x2weixXUnoRkUW02bggLEv9yJFb6DPXyJLhUXQHZb7lXrgUQgND0snfSVU563VjVP138f4-nejEKUW6U8AqfZALIbaoFzkZOL7pGKs7XysC7A5iL2YAe_a-HLji7AiZB0b3hjcS3oj0Gw5cgtDsxxvSkArs70QYvhSFiq4Cahwb0',
    '{}', array['Workwear', 'Evening'], array['Wool'], array['Tailoring'],
    array['Lapel scale', 'Lining', 'Length'], array['blazer', 'charcoal'], true, now()
  ),
  (
    (select id from public.boutiques where slug = 'atelier-nysa'),
    'burgundy-linen-trousers', 'Burgundy Linen Trousers',
    'Wide-leg organic linen trousers with a fixed-fluid construction.',
    'published', 1800000, 2, 4,
    'https://lh3.googleusercontent.com/aida-public/AB6AXuC8p0h2gfOIXWKQq4NYzooRO7o-l3B8avh2hpC5KiCx532bv2G4iF_h-7uY5Dlyeewi92wMltPk-7D3ttfdKUSUaYY2wHoxtM8zTJkKRHscLdVljZjK0J8JbZf6siPJmzADFjWnBi23wBxWO_H9FONaqZvpTPqn56rw1ceJdGWgrSXv8hBomvdNosN4xRwPDYkOLBxudaxqeKSPpAYN7uhzrm3ezwpiyMdoBV6HyzwNy9DQwrpqeeeJ',
    '{}', array['Casual', 'Festive'], array['Organic linen'], array['Zero-waste cutting'],
    array['Waist rise', 'Length'], array['trousers', 'linen'], false, now()
  )
on conflict (slug) do update set
  title = excluded.title,
  description = excluded.description,
  status = excluded.status,
  base_price_paise = excluded.base_price_paise,
  lead_time_min_weeks = excluded.lead_time_min_weeks,
  lead_time_max_weeks = excluded.lead_time_max_weeks,
  primary_image_url = excluded.primary_image_url,
  gallery_image_urls = excluded.gallery_image_urls,
  occasions = excluded.occasions,
  materials = excluded.materials,
  techniques = excluded.techniques,
  customizable_elements = excluded.customizable_elements,
  tags = excluded.tags,
  is_featured = excluded.is_featured,
  published_at = excluded.published_at;
