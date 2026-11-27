# Frontend del POS

Aplicación Vue 3 + TypeScript + Pinia con soporte offline (IndexedDB + Service Worker).

| Comando | Qué hace |
|---|---|
| `npm run dev` | Modo desarrollo en http://localhost:5173 (reenvía `/api` al backend en el puerto 3000) |
| `npm run build` | Revisa tipos y compila para producción (carpeta `dist/`) |
| `npm run test:unit` | Pruebas unitarias (Vitest) |
| `npm run test:e2e` | Pruebas de punta a punta (Playwright) |
| `npm run lint` | Revisión de estilo de código |

La explicación de cada carpeta y archivo está en [../docs/GUIA_DEL_PROYECTO.md](../docs/GUIA_DEL_PROYECTO.md).
