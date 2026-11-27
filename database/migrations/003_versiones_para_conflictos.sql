-- =====================================================================
-- Migración 003: número de versión para detectar conflictos
-- ---------------------------------------------------------------------
-- Bloqueo optimista: cada vez que se edita un producto o una categoría
-- su "version" sube en 1. Si un dispositivo intenta guardar un cambio
-- basado en una versión vieja, el servidor responde 409 (conflicto)
-- en lugar de pisar el cambio que hizo otra persona.
-- =====================================================================

ALTER TABLE products   ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE products   ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
