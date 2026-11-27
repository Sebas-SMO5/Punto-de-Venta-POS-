-- =====================================================================
-- Migración 002: sesiones con Refresh Token rotativo
-- ---------------------------------------------------------------------
-- Cada vez que alguien inicia sesión se crea una "familia" (family_id),
-- que representa ese dispositivo/navegador. Cada renovación crea un token
-- nuevo dentro de la misma familia y marca el anterior como usado.
-- Nunca se guarda el token real: solo su huella SHA-256 (token_hash).
-- =====================================================================

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_id   UUID NOT NULL,
  token_hash  CHAR(64) NOT NULL UNIQUE,
  user_agent  VARCHAR(255),
  ip_address  VARCHAR(64),
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at  TIMESTAMP NOT NULL,
  used_at     TIMESTAMP,
  revoked_at  TIMESTAMP,
  revoked_reason VARCHAR(40)
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family ON refresh_tokens (family_id);
