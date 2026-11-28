# Guion para la sustentación (demo de ~17 minutos)

Este guion muestra, en orden, cada requisito de la guía con algo que el jurado
pueda **ver**. Al lado de cada paso está qué decir y qué criterio de la rúbrica
cubre.

## Antes de empezar (preparación)

- [ ] Abrir la app en la nube **5 minutos antes** (el plan gratis tarda en
      "despertar"): https://pos-restaurante-y2m9.onrender.com
- [ ] Tener creados en la nube: un **admin** (variables `ADMIN_*` de Render),
      y un **cajero** y un **mesero** (desde la pantalla **Usuarios**).
- [ ] Usar **Google Chrome**. Abrir las herramientas de desarrollador (`F12`)
      en las pestañas **Application** y **Network**.
- [ ] Tener abierto en VS Code: `Frontend/src/offline/syncRules.ts`,
      `Backend/src/domain/orderRules.js` y `docs/GUIA_DEL_PROYECTO.md`.
- [ ] Tener una terminal lista para correr las pruebas.

---

## 1. Presentación (1 min)

> "Construimos un POS para restaurante **Offline-First**: el restaurante sigue
> vendiendo sin internet y, al volver la conexión, todo se sincroniza solo y
> los conflictos se resuelven con reglas determinísticas."

Mostrar el dibujo de la sección 2 de la guía (frontend, IndexedDB, Service
Worker, API por capas, PostgreSQL).

## 2. Seguridad: doble token (2 min) — *Seguridad*

1. Iniciar sesión como **admin**.
2. En `F12 → Application → Local Storage`: mostrar que **no hay ningún token**
   (solo el perfil: id, nombre, rol).
3. En `Application → Cookies`: mostrar `pos_refresh` con **HttpOnly ✓,
   Secure ✓, SameSite Strict**.
4. En la consola escribir `document.cookie` → **no aparece** `pos_refresh`.
5. Recargar la página: la sesión sigue (se renovó con la cookie). En
   **Network** se ve la petición `refresh`.
6. Ir a **Mis sesiones**: mostrar las sesiones abiertas y cerrar una.

> "El Access Token dura 15 minutos y vive solo en memoria. El Refresh Token
> rota en cada uso; si alguien reutiliza uno viejo, cerramos toda la sesión."

## 3. Permisos por rol y propiedad (2 min) — *Seguridad (RBAC/ABAC)*

1. Cerrar sesión y entrar como **mesero**: el menú ya no tiene Categorías,
   Inventario ni Historial de ventas.
2. Escribir a mano `/categories` en la barra: el router lo devuelve al inicio.
3. Crear un pedido; entregarlo: **no aparece "Registrar venta"** (el mesero no
   cobra).
4. (Opcional) Con otro mesero, intentar cambiar ese pedido → la API responde
   **403**: un mesero solo cambia sus propios pedidos.

## 4. Offline-First (4 min) — *Desafío técnico*

Entrar como **cajero**.

1. `F12 → Network → No throttling → **Offline**`. La barra superior dice
   "Sin conexión".
2. **Punto de venta → + Nuevo pedido**: elegir mesa y productos, registrar.
   El mensaje dice que se guardó sin conexión. En la tabla aparece
   "Sin sincronizar".
3. Entregar el pedido y **cobrarlo** sin conexión → "Pendiente de
   sincronización".
4. **Recargar la página estando offline**: la app abre igual (Service Worker).
5. Ir a **Sincronización**: se ven las operaciones en la cola (crear pedido,
   cambiar estado, crear venta).
6. Volver a **Online**: en segundos la cola queda vacía, el pedido recibe su
   número real y la venta aparece en el **Historial de ventas**.

> "Las operaciones se envían en el mismo orden en que ocurrieron. La venta
> espera a que su pedido se cree primero. Cada pedido lleva un UUID, así que
> aunque se envíe dos veces no se duplica."

## 5. Conflictos determinísticos (3 min) — *Desafío técnico + Concurrencia*

Abrir **dos ventanas** como admin (una normal y otra de incógnito).

**Conflicto de edición (bloqueo optimista):**
1. Ventana A: poner **Offline** y cambiar el precio de un producto.
2. Ventana B (online): cambiar el precio del mismo producto.
3. Ventana A: volver **Online** → en **Sincronización** aparece el
   **conflicto**, con "En este dispositivo" y "En el servidor".
4. Elegir **"Usar la del servidor"** o **"Mantener mi cambio"**. Queda
   registrado en el **Historial de resolución**.

**Conflicto automático (máquina de estados):**
1. Ventana A offline: cancelar un pedido.
2. Ventana B online: entregar el mismo pedido.
3. Ventana A online: el historial dice **"Ganó el servidor"**. Un pedido
   entregado ya no se puede cancelar.

> Mostrar la tabla de reglas en `Frontend/src/offline/syncRules.ts`:
> "Ante la misma situación, el sistema siempre toma la misma decisión."

**Stock (bloqueo pesimista):** explicar que al cobrar se usa
`SELECT ... FOR UPDATE` dentro de una transacción; si el stock no alcanza, la
venta offline queda como conflicto para reintentar o descartar.

## 6. Inventario y usuarios (2 min) — *Lógica de negocio*

1. Como admin, en **Usuarios**: crear un cajero nuevo en vivo y mostrar que
   puede entrar. Desactivarlo: su sesión se cierra al instante.
2. En **Inventario**: registrar una **entrada** (+10) y mostrar el historial de
   movimientos con quién la hizo.
3. Poner **Offline** y registrar otra entrada: se guarda y se sincroniza al
   volver. Explicar por qué las entradas sí funcionan offline (solo suman) y
   los **ajustes** no (dejan un número exacto y podrían borrar ventas).

## 7. Arquitectura y calidad (2 min) — *Arquitectura + Frontend*

- Backend: `routes → middlewares → controllers → services → repositories`.
- `Backend/src/domain/orderRules.js`: reglas puras, fáciles de probar.
- Frontend: tiendas Pinia normalizadas con `loading/error/caché`, guard
  asíncrono en `router/index.ts`, axios con reintentos, **0 `any`**.
- Pantallas divididas en componentes (`components/orders/`).
- Logs JSON con `x-correlation-id` (mostrar una respuesta en Network).

## 8. Pruebas, Git y nube (1 min) — *Testing, Git y Despliegue*

```bash
cd Backend && npm test          # 63 pruebas (unitarias + integración)
cd Frontend && npm run test:unit  # 46 pruebas (unitarias + componentes)
cd Frontend && npm run test:e2e   # 6 pruebas en Chrome, incluido el flujo offline
```

- Mostrar en GitHub los Pull Requests y la pestaña **Actions** (CI en verde).
- Mostrar la app funcionando en Render.

## Preguntas que pueden hacer (y respuestas cortas)

| Pregunta | Respuesta |
|---|---|
| ¿Por qué no guardar el token en localStorage? | Cualquier script (XSS) lo podría leer. La cookie HttpOnly es invisible para JavaScript. |
| ¿Cómo funciona sin internet si el token está en memoria? | Se guarda solo el perfil; las operaciones se encolan y al volver internet la sesión se renueva con la cookie antes de sincronizar. |
| ¿Qué pasa si se envía dos veces el mismo pedido? | Lleva un UUID (`localId`); el servidor devuelve el que ya existe (idempotencia). |
| ¿Optimista o pesimista? | Pesimista al cobrar (concurrencia en el momento); optimista al editar (alguien puede editar offline durante horas). |
| ¿Qué significa determinístico? | Misma situación → misma decisión, sin importar el orden de llegada. |
| ¿Cómo garantizan que todos tengan la misma base de datos? | Migraciones versionadas en `database/migrations`, aplicadas en orden con `npm run migrate`. |
| ¿Qué tablas no se usan? | Cajas, ingredientes, recetas y dispositivos: quedan preparadas para una versión futura. |
