-- ShopLite seed data

INSERT INTO products (id, name, price, description) VALUES
  ('a1b2c3d4-0000-0000-0000-000000000001', 'Widget Pro',     29.99, 'A professional-grade widget'),
  ('a1b2c3d4-0000-0000-0000-000000000002', 'Gadget Ultra',   49.99, 'Ultra performance gadget'),
  ('a1b2c3d4-0000-0000-0000-000000000003', 'Doohickey Basic', 9.99, 'Entry-level doohickey'),
  ('a1b2c3d4-0000-0000-0000-000000000004', 'Thingamajig X', 19.99, 'The versatile thingamajig'),
  ('a1b2c3d4-0000-0000-0000-000000000005', 'Gizmo Plus',    39.99, 'Enhanced gizmo with extras')
ON CONFLICT (id) DO NOTHING;

-- Seed orders across different fake user IDs to demonstrate the missingRLS vuln
INSERT INTO orders (id, user_id, product_name, amount) VALUES
  (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000001', 'Widget Pro',      29.99),
  (gen_random_uuid(), 'bbbbbbbb-0000-0000-0000-000000000002', 'Gadget Ultra',    49.99),
  (gen_random_uuid(), 'cccccccc-0000-0000-0000-000000000003', 'Doohickey Basic',  9.99)
ON CONFLICT DO NOTHING;
