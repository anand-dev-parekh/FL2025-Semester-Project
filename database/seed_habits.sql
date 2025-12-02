INSERT INTO habits (name, description) VALUES
  ('Exercise', 'Track minutes of moderate-to-vigorous movement.'),
  ('Steps', 'Count your daily steps to stay active.'),
  ('Sleep Well', 'Record minutes of quality sleep each night.'),
  ('Hydration', 'Measure ounces of water you drink.'),
  ('Mindfulness', 'Log minutes spent meditating or practicing breath work.'),
  ('Learning', 'Capture minutes invested in studying or reading.'),
  ('Creativity', 'Track minutes making art, music, or writing.'),
  ('Nature Time', 'Record minutes spent outdoors or walking.'),
  ('Financial Awareness', 'Dollars saved, invested, or budgeted intentionally.'),
  ('Digital Balance', 'Minutes of intentional screen-free time.')
ON CONFLICT (name) DO NOTHING;
