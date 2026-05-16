-- Insert missing homepage tags
INSERT INTO product_tags (tag_key, tag_label, sort_order, is_active) VALUES
  ('festivals-events', 'Festivals & Events', 5, true),
  ('festival-gifting', 'Festival Special Gifting', 6, true),
  ('smart-reorder', 'Smart Reorder', 7, true),
  ('private-label', 'Private Label Retail Ready', 8, true),
  ('recommended', 'Recommended', 9, true),
  ('packing-solution', 'Packing Solution', 10, true)
ON CONFLICT DO NOTHING;