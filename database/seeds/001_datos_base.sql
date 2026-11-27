-- =====================================================================
-- Datos iniciales (semilla) para una base de datos nueva
-- ---------------------------------------------------------------------
-- Carga categorías, medios de pago, mesas, productos con su inventario
-- y datos de ingredientes/cajas. "ON CONFLICT DO NOTHING" evita duplicar
-- datos si se ejecuta dos veces.
-- Los usuarios NO se crean aquí: se crean con el script
--   npm run create-user -- <usuario> <contraseña> <rol> "Nombre"
-- para que la contraseña quede cifrada con bcrypt.
-- =====================================================================

INSERT INTO categories (name, description) VALUES
  ('Comidas',  'Platos principales del restaurante'),
  ('Bebidas',  'Bebidas frías y calientes'),
  ('Entradas', 'Entradas y acompañamientos'),
  ('Postres',  'Postres y dulces'),
  ('Combos',   'Combos y promociones')
ON CONFLICT (name) DO NOTHING;

INSERT INTO payment_methods (name) VALUES
  ('Efectivo'), ('Tarjeta'), ('Transferencia'), ('Nequi'), ('Daviplata')
ON CONFLICT (name) DO NOTHING;

INSERT INTO restaurant_tables (table_number, capacity) VALUES
  (1, 2), (2, 4), (3, 4), (4, 6), (5, 8)
ON CONFLICT (table_number) DO NOTHING;

INSERT INTO products (category_id, name, description, price, sku)
SELECT c.id, p.name, p.description, p.price, p.sku
FROM (VALUES
  ('Comidas',  'Arroz con pollo',  'Arroz con pollo y verduras',  18000, 'PROD001'),
  ('Comidas',  'Bandeja paisa',    'Plato típico colombiano',     28000, 'PROD002'),
  ('Entradas', 'Empanadas',        'Porción de tres empanadas',    8000, 'PROD003'),
  ('Bebidas',  'Limonada natural', 'Limonada preparada en casa',   6000, 'PROD004'),
  ('Postres',  'Flan de caramelo', 'Postre casero de caramelo',    7000, 'PROD005')
) AS p(category, name, description, price, sku)
JOIN categories c ON c.name = p.category
ON CONFLICT (sku) DO NOTHING;

INSERT INTO inventory (product_id, current_stock, minimum_stock)
SELECT pr.id, s.stock, s.minimum
FROM (VALUES
  ('PROD001', 30, 5), ('PROD002', 20, 5), ('PROD003', 50, 10),
  ('PROD004', 40, 8), ('PROD005', 25, 5)
) AS s(sku, stock, minimum)
JOIN products pr ON pr.sku = s.sku
ON CONFLICT (product_id) DO NOTHING;

INSERT INTO units (name, abbreviation) VALUES
  ('Kilogramo', 'kg'), ('Gramo', 'g'), ('Litro', 'L'), ('Mililitro', 'ml'), ('Unidad', 'und')
ON CONFLICT (name) DO NOTHING;

INSERT INTO cash_registers (name, description) VALUES
  ('Caja principal',    'Caja registradora principal del restaurante'),
  ('Caja secundaria',   'Caja para atención adicional'),
  ('Caja de domicilios','Caja para ventas de domicilios')
ON CONFLICT (name) DO NOTHING;
