# POS Restaurante — Offline-First

Punto de venta para restaurante que **sigue funcionando sin internet** y
sincroniza los cambios automáticamente al volver la conexión, con resolución
determinística de conflictos.

- **Frontend:** Vue 3 + TypeScript + Pinia + IndexedDB + Service Worker
- **Backend:** Node.js + Express (arquitectura por capas)
- **Base de datos:** PostgreSQL con migraciones versionadas
- **Seguridad:** doble token (Access en memoria + Refresh rotativo en cookie
  HttpOnly), RBAC con propiedad del recurso, Zod, bcrypt, rate limiting, helmet

📘 **Documentación completa:** [docs/GUIA_DEL_PROYECTO.md](docs/GUIA_DEL_PROYECTO.md)

## Inicio rápido

```bash
npm run install:all                 # instala backend y frontend
cp Backend/.env.example Backend/.env  # y edite sus datos de PostgreSQL
cd Backend
npm run migrate -- --seed           # crea las tablas y datos de ejemplo
npm run create-user -- admin Admin2026* admin "Administrador"
npm run dev                         # backend en http://localhost:3000
```

En otra terminal:

```bash
cd Frontend
npm run dev                         # abrir http://localhost:5173
```

## Pruebas

```bash
npm test             # backend (unitarias + integración) y frontend (unitarias)
npm run test:e2e     # punta a punta con Playwright
```

## Despliegue

Listo para Render con [`render.yaml`](render.yaml). Ver la sección 8 de la guía.
