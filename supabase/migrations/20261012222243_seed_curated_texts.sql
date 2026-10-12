-- A small curated starter corpus so the solo typing screen has real data.
-- difficulty_rating/difficulty_source keep their defaults (1200, heuristic)
-- until the Elo-style calibration described in DESIGN.md is built.
insert into public.texts (content, category, status) values
  ('The quick brown fox jumps over the lazy dog.', 'quote', 'approved'),
  ('Pack my box with five dozen liquor jugs.', 'quote', 'approved'),
  ('Sphinx of black quartz, judge my vow.', 'quote', 'approved'),
  ('Programming is the art of telling another human what one wants the computer to do.', 'quote', 'approved'),
  ('The only way to do great work is to love what you do, and if you have not found it yet, keep looking and do not settle.', 'quote', 'approved'),
  ('Version 2.0 shipped on 03/14/2024 with a 15% faster build time, fixing bugs #102, #118, and #145 (per the changelog).', 'quote', 'approved'),
  ('const total = items.reduce((sum, item) => sum + item.price, 0);', 'code', 'approved');
