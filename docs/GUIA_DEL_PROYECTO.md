# Guía del proyecto: POS para restaurante "Offline-First"

> Proyecto 10 del Nivel 3 de la guía de grado: **Punto de Venta (POS) con
> arquitectura Offline-First completa**.
>
> Este documento explica, con palabras sencillas, **qué hace el proyecto,
> qué se cambió para cumplir los requisitos, y para qué sirve cada carpeta y
> cada archivo**. Está pensado para alguien que está aprendiendo.

---

## Índice

1. [¿Qué es este proyecto?](#1-qué-es-este-proyecto)
2. [La idea general en un dibujo](#2-la-idea-general-en-un-dibujo)
3. [Cómo ponerlo a funcionar](#3-cómo-ponerlo-a-funcionar)
4. [Resumen de los cambios realizados](#4-resumen-de-los-cambios-realizados)
5. [Conceptos importantes explicados fácil](#5-conceptos-importantes-explicados-fácil)
6. [Recorrido carpeta por carpeta y archivo por archivo](#6-recorrido-carpeta-por-carpeta-y-archivo-por-archivo)
7. [Las pruebas automáticas](#7-las-pruebas-automáticas)
8. [Cómo subirlo a la nube](#8-cómo-subirlo-a-la-nube)
9. [Lo que todavía queda por hacer](#9-lo-que-todavía-queda-por-hacer)
10. [Glosario](#10-glosario)

---

## 1. ¿Qué es este proyecto?

Es un sistema para un restaurante donde los meseros toman pedidos, los cajeros
cobran y el administrador maneja el menú y el inventario.

Lo especial es que es **Offline-First** ("primero sin conexión"): si se va el
internet, **el restaurante puede seguir trabajando**. Los pedidos y ventas se
guardan en el propio navegador y, cuando vuelve la conexión, se envían solos al
servidor. Si dos personas cambiaron lo mismo mientras estaban desconectadas,
el sistema sabe cómo resolver ese **conflicto** siempre de la misma manera.

El proyecto tiene tres partes:

| Parte | Tecnología | Qué hace |
|---|---|---|
| **Frontend** | Vue 3 + TypeScript + Pinia | Lo que ve el usuario en el navegador (pantallas). |
| **Backend** | Node.js + Express | El "servidor": recibe pedidos del frontend, aplica las reglas y habla con la base de datos. |
| **Base de datos** | PostgreSQL | Donde se guarda la información de forma permanente. |

---

## 2. La idea general en un dibujo

```
 ┌──────────────────────── NAVEGADOR (Frontend) ────────────────────────┐
 │                                                                       │
 │  Pantallas (Vue) ──▶ Servicios ──▶ ¿Hay internet?                     │
 │                                      │SÍ                 │NO          │
 │                                      ▼                   ▼            │
 │                              API del servidor     IndexedDB (copia    │
 │                                                    local + COLA de    │
 │                                                    cambios pendientes)│
 │                                                          │            │
 │  Service Worker: guarda la página para que abra          │ al volver  │
 │  aunque no haya internet.                                │ internet   │
 │                                         Sincronizador ◀──┘            │
 └──────────────────────────────────────────────┬────────────────────────┘
                                                │ HTTPS
 ┌──────────────────────── SERVIDOR (Backend) ──▼────────────────────────┐
 │  Ruta ──▶ Middlewares (seguridad, validación) ──▶ Controlador          │
 │        ──▶ Servicio (reglas del negocio) ──▶ Repositorio (SQL)         │
 └──────────────────────────────────────────────┬────────────────────────┘
                                                ▼
                                   PostgreSQL (base de datos)
```

---

## 3. Cómo ponerlo a funcionar

### Requisitos
- **Node.js** 20 o superior.
- **PostgreSQL** 13 o superior instalado en el computador.

### Primera vez (cada integrante del equipo)

1. **Instalar las librerías** (desde la carpeta raíz del proyecto):
   ```bash
   npm run install:all
   ```
2. **Configurar el backend:** copiar `Backend/.env.example` como `Backend/.env`
   y poner los datos de su PostgreSQL. `JWT_SECRET` debe ser un texto largo
   (mínimo 16 caracteres). **El `.env` nunca se sube a GitHub.**
3. **Crear o actualizar las tablas** de la base de datos:
   ```bash
   cd Backend
   npm run migrate -- --seed
   ```
   (`--seed` carga datos de ejemplo: categorías, mesas, productos…).
   Si su base ya tenía tablas, no se pierde nada: solo agrega lo que falta.
4. **Crear un usuario** (la contraseña queda cifrada):
   ```bash
   npm run create-user -- admin Admin2026* admin "Administrador"
   ```
   Los roles posibles son `admin`, `cashier` (cajero) y `waiter` (mesero).

### Todos los días

Abrir **dos terminales**:

```bash
# Terminal 1
cd Backend
npm run dev        # servidor en http://localhost:3000

# Terminal 2
cd Frontend
npm run dev        # página en http://localhost:5173
```

Abrir **http://localhost:5173** en el navegador.

> 💡 Si cambia algo del archivo `.env`, hay que **detener** el backend
> (`Ctrl + C`) y volver a iniciarlo; los cambios del `.env` no se aplican solos.

### Usuarios de prueba en la base de datos de Sebastián

| Usuario | Contraseña | Rol |
|---|---|---|
| `admin` | `Admin2026*` | Administrador |
| `cajero1` | `Cajero2026*` | Cajero |
| `mesero1` | `Mesero2026*` | Mesero |

En otro computador hay que crearlos con `npm run create-user`.

---

## 4. Resumen de los cambios realizados

La siguiente tabla compara cómo estaba el proyecto y cómo quedó, siguiendo los
requisitos de la guía de grado.

| Requisito de la guía | Antes | Ahora |
|---|---|---|
| **Rutas protegidas** | Ninguna ruta pedía iniciar sesión. Cualquiera podía crear o borrar productos y ventas. | Todas las rutas (menos login y health) exigen sesión. |
| **Doble token** | Un solo token guardado en `localStorage` (la rúbrica lo califica como "Insuficiente"). | Access Token de 15 minutos **solo en memoria** + Refresh Token en **cookie HttpOnly, SameSite=Strict, Secure** que **rota** en cada uso. |
| **Revocación de sesiones** | No existía. | Cerrar una sesión, cerrar todas, límite de 5 sesiones por usuario y detección de robo de token. Pantalla "Mis sesiones". |
| **Permisos por rol (RBAC)** | El middleware existía pero no se usaba. | Cada ruta indica qué roles pueden usarla; el menú solo muestra lo permitido. |
| **Propiedad del recurso** | No existía. | Un mesero solo puede cambiar o cancelar **sus propios** pedidos. |
| **Contraseñas** | 4 usuarios de prueba con la contraseña sin cifrar. | Todas cifradas con bcrypt. |
| **Validación con Zod** | La librería no estaba instalada; el archivo no funcionaba. | Esquemas Zod para todas las entradas, rechazan HTML (XSS) y campos extra. |
| **Límite de intentos** | No existía. | Máximo 10 intentos fallidos de login cada 15 minutos; 300 peticiones por minuto en general. |
| **Cabeceras de seguridad** | No existían. | `helmet` agrega cabeceras de seguridad del navegador. |
| **Migraciones** | La carpeta `database/` estaba vacía: nadie podía recrear la base. | 3 migraciones versionadas + datos iniciales + comando `npm run migrate`. |
| **Conflictos de sincronización** | Si algo fallaba, la operación quedaba en "error" para siempre. | Reglas **determinísticas** (ver sección 5.7), pantalla para resolver conflictos e historial. |
| **Bloqueo optimista** | No existía. | Productos y categorías tienen `version`; si alguien edita con una versión vieja → conflicto 409. |
| **Service Worker** | Existía un archivo, pero **nunca se registraba**. | Registrado y probado: la app abre sin internet aunque se recargue. |
| **Logs con x-correlation-id** | `console.log` sueltos. | Logs en formato JSON con un número de seguimiento por petición. |
| **Cola de tareas en memoria** | No existía. | Cola con reintentos (alerta de stock bajo, limpieza de tokens vencidos). |
| **Manejo global de errores** | Básico; los middlewares de error no se usaban. | Un solo manejador que traduce todos los errores al mismo formato. |
| **TypeScript sin `any`** | 19 usos de `any`. | **0 usos.** |
| **Pinia** | Tiendas de ejemplo y pedidos guardados en `localStorage`. | Tiendas normalizadas con estados de carga, error y caché. |
| **Navigation Guards asíncronos** | Guard síncrono. | Guard asíncrono que recupera la sesión y revisa el rol. |
| **Axios con reintentos** | Sin reintentos. | Reintento automático con espera creciente + renovación de sesión automática. |
| **Pruebas** | Ninguna. | 49 pruebas del backend, 36 unitarias y de componentes del frontend y 4 de punta a punta. Todas pasan. |
| **CI** | No existía. | GitHub Actions corre todas las pruebas en cada Pull Request. |
| **Despliegue** | No existía. | Desplegado en Render: https://pos-restaurante-y2m9.onrender.com |
| **Pantallas sobrecargadas** | `SalesView.vue` tenía 947 líneas y repetía casi todo `OrdersView.vue`. | Divididas en componentes reutilizables, un composable de acciones y tiendas de Pinia. Cada pantalla quedó en unas 80 líneas. |
| **Código sin uso** | Rutas y servicios rotos, archivos vacíos, plantillas. | Eliminados. |

### Archivos eliminados (y por qué)

| Archivo | Motivo |
|---|---|
| `Backend/src/routes/sync.routes.js`, `services/sync.service.js` | Usaban archivos que no existían y no estaban conectados al servidor. La sincronización la hace el frontend contra las rutas normales. |
| `Backend/src/routes/payments.routes.js` | Estaba vacío. Se reemplazó por `paymentMethods.routes.js`. |
| `Backend/src/scripts/create-admin.js` | Reemplazado por `create-user.js`, que permite elegir el rol. |
| `Backend/src/config/README.md` | Estaba vacío. |
| `Frontend/src/stores/counter.ts` | Ejemplo que trae Vue al crear un proyecto. |
| `Frontend/src/stores/tables.ts`, `types/order.ts`, `types/product.ts`, `types/table.ts`, `views/InvoicePaymentsView.vue` | Archivos vacíos. |
| `Frontend/src/components/OrderCard.vue`, `ProductCard.vue` | Ninguna pantalla los usaba. |

---

## 5. Conceptos importantes explicados fácil

### 5.1 El doble token (inicio de sesión)

Imagine la entrada a un evento:

- **Access Token** = la **manilla** del día. Sirve para entrar a cada zona,
  pero **vence rápido (15 minutos)**. El navegador la guarda **solo en
  memoria**: si se recarga la página, se pierde a propósito.
- **Refresh Token** = la **boleta original**, guardada en una **cookie
  especial** que el JavaScript de la página **no puede leer** (`HttpOnly`).
  Solo sirve para pedir una manilla nueva en `/api/auth/refresh`.

¿Por qué así? Si un atacante logra meter código malicioso en la página (XSS),
no puede robar la boleta (la cookie es invisible para JavaScript), y la manilla
que podría ver vence en minutos.

**Rotación:** cada vez que se usa la boleta, el servidor la cambia por una
nueva y marca la vieja como usada. **Si alguien intenta usar una boleta
vieja**, el servidor entiende que fue robada y **cierra toda esa sesión**.

**Las tres protecciones de la cookie:**
- `HttpOnly`: JavaScript no la puede leer.
- `SameSite=Strict`: otras páginas web no pueden hacer que el navegador la envíe (protege de CSRF).
- `Secure`: solo viaja por HTTPS (en `localhost` también funciona).

En la base de datos **no se guarda el token**, solo su "huella" (hash SHA-256).
Si alguien roba la base de datos, no puede usar esas huellas para entrar.

### 5.2 Permisos por rol (RBAC) y propiedad del recurso

| Acción | Administrador | Cajero | Mesero |
|---|:-:|:-:|:-:|
| Ver menú, mesas y pedidos | ✅ | ✅ | ✅ |
| Crear pedidos | ✅ | ✅ | ✅ |
| Cambiar o cancelar **cualquier** pedido | ✅ | ✅ | ❌ (solo los suyos) |
| Cobrar y ver ventas | ✅ | ✅ | ❌ |
| Ver inventario | ✅ | ✅ | ❌ |
| Crear o editar productos y categorías | ✅ | ❌ | ❌ |

- Si alguien sin permiso intenta algo, la API responde **403 (prohibido)**.
- **Propiedad del recurso**: además del rol, se revisa **de quién es** el dato.
  Un mesero puede cambiar pedidos, pero solo los que él mismo creó.
- El pedido siempre queda a nombre de **quien inició sesión**; el navegador no
  puede decir "este pedido es de otra persona".

### 5.3 Validación de datos con Zod

Antes de que un dato llegue a la base de datos, se compara con una "regla"
(esquema). Ejemplos: el precio debe ser un número mayor que cero, el nombre no
puede tener `<` ni `>` (evita meter código HTML/JavaScript), no se aceptan
campos que no estén en la lista. Si algo no cumple, la API responde **400** y
explica qué campo está mal.

**Contra la inyección SQL:** todas las consultas usan parámetros (`$1`, `$2`…),
nunca se pega texto del usuario dentro del SQL.

### 5.4 Transacciones (ACID) y bloqueos

Una **transacción** es un grupo de pasos que se hacen **todos o ninguno**.
Al cobrar un pedido se crea la venta, sus productos, el pago y se descuenta el
inventario. Si cualquier paso falla, **se deshace todo** (`ROLLBACK`).

- **Bloqueo pesimista** (`SELECT ... FOR UPDATE`): "aparto" la fila mientras
  la uso. Se usa al cobrar: si dos cajas cobran el mismo pedido al mismo
  tiempo, la segunda espera y luego ve que ya está cobrado.
- **Bloqueo optimista** (columna `version`): no se aparta nada, pero al
  guardar se revisa que nadie haya cambiado el dato. Se usa al editar productos
  y categorías, porque alguien puede editar sin conexión durante horas.

### 5.5 Offline-First: cómo trabaja sin internet

1. Cada vez que hay internet, los servicios guardan una **copia** de los datos
   (productos, mesas, pedidos…) en **IndexedDB**, una base de datos que vive
   dentro del navegador.
2. Sin internet, las pantallas leen de esa copia.
3. Lo que se cree o cambie sin internet se guarda localmente y se anota en una
   **cola** (`syncQueue`). Los registros nuevos usan un **id negativo
   temporal** (por ejemplo `-1732650000000`).
4. Al volver internet (y cada 15 segundos), el **sincronizador** envía la cola
   **en el mismo orden** en que pasaron las cosas. Cuando el servidor devuelve
   el id real, se reemplaza el id temporal en todas las operaciones que lo usaban.
5. Si una operación depende de otra que todavía no se envía (por ejemplo,
   cobrar un pedido creado sin conexión), **espera su turno**.

**¿Y si se recarga la página sin internet?** El **Service Worker** guardó una
copia de la página, así que abre igual. La sesión sigue con el perfil guardado
(nombre y rol, **nunca** los tokens), y al volver internet se renueva sola con
la cookie.

**¿Y si se envía dos veces lo mismo?** Cada pedido lleva un identificador único
(`localId`). Si llega repetido, el servidor devuelve el mismo pedido en vez de
crear otro (**idempotencia**). Lo mismo con las ventas: un pedido solo se puede
cobrar una vez.

### 5.6 Los estados de un pedido (máquina de estados)

Un pedido **solo puede avanzar**, nunca devolverse:

```
pendiente ──▶ en preparación ──▶ listo ──▶ entregado
     │               │              │
     └───────────────┴──────────────┴──▶ cancelado
```

"Entregado" y "cancelado" son **finales**: ya no se pueden cambiar.

### 5.7 Resolución DETERMINÍSTICA de conflictos

"Determinística" significa que **ante la misma situación, siempre se toma la
misma decisión**, sin importar quién llegó primero. Estas son las reglas
(archivo `Frontend/src/offline/syncRules.ts`):

| Situación al sincronizar | Qué pasa | ¿Automático? |
|---|---|---|
| No hay red o el servidor está caído | Se queda pendiente y se reintenta esperando cada vez más (2s, 4s, 8s… máx. 5 min). | Sí |
| La sesión venció | Se detiene hasta que la sesión se renueve. | Sí |
| El mismo pedido llega dos veces | El servidor devuelve el que ya existe (no se duplica). | Sí |
| Cambio de estado de un pedido que **ya avanzó** en otro dispositivo | **Gana el estado más avanzado** (el del servidor). | Sí |
| Editar o borrar algo que **ya no existe** | Se descarta; gana el servidor. | Sí |
| Editar un producto o categoría que **otra persona cambió** (versión distinta) | **Conflicto**: el usuario elige "Mantener mi cambio" o "Usar la del servidor". | No, decide una persona |
| Cobrar una venta y **ya no hay stock suficiente** | **Conflicto**: el usuario elige "Reintentar" o "Descartar venta". | No, decide una persona |
| Datos inválidos o sin permiso | Queda como **error** para revisión; se puede descartar. | No |

Todo lo que se resuelve, automática o manualmente, queda en el **Historial de
resolución** de la pantalla *Sincronización*.

### 5.8 Logs con x-correlation-id

Cada petición recibe un **número de seguimiento** que se devuelve en la
cabecera `x-correlation-id` y aparece en todas las líneas del log. Si un
usuario reporta un error, con ese número se encuentran todas las líneas de esa
petición. Los logs se escriben en formato JSON, por ejemplo:

```json
{"time":"2026-11-27T22:36:38.745Z","level":"warn","message":"Petición rechazada","correlationId":"942e8346-...","status":401,"path":"/api/products"}
```

### 5.9 Cola de tareas en memoria

Algunas cosas no tienen que hacerse "ya mismo". Después de una venta, revisar
si un producto quedó con poco stock se hace **en segundo plano**: la venta
responde de inmediato y la revisión ocurre un instante después. Si la tarea
falla, se reintenta hasta 3 veces.

### 5.10 Migraciones

Una **migración** es un archivo SQL numerado que cambia la base de datos
(crear una tabla, agregar una columna…). El comando `npm run migrate` aplica,
**en orden**, solo las que falten, y anota cuáles ya aplicó en la tabla
`schema_migrations`. Así **todos los integrantes y la nube tienen exactamente
la misma estructura** de base de datos.

> ⚠️ Una migración que ya se aplicó **no se edita**. Si hay que cambiar algo,
> se crea una nueva (por ejemplo `004_...sql`).

---

## 6. Recorrido carpeta por carpeta y archivo por archivo

Leyenda: 🆕 nuevo · ✏️ modificado · (sin marca) sin cambios importantes.

### 6.1 Carpeta raíz

| Archivo | Para qué sirve |
|---|---|
| ✏️ `package.json` | Atajos para todo el proyecto: `npm run install:all`, `npm test`, `npm run build`, `npm start`. Antes solo tenía `axios`, que no se usaba aquí. |
| 🆕 `render.yaml` | "Receta" para que Render cree la base de datos y el servidor en la nube. |
| 🆕 `.github/workflows/ci.yml` | Le dice a GitHub que corra todas las pruebas en cada cambio o Pull Request. |
| `.gitignore` | Lista de lo que **no** se sube a GitHub (`node_modules`, `.env`…). |
| 🆕 `docs/GUIA_DEL_PROYECTO.md` | Este documento. |

### 6.2 `database/` — la estructura de la base de datos

| Archivo | Para qué sirve |
|---|---|
| 🆕 `migrations/001_esquema_inicial.sql` | Crea **todas** las tablas del sistema (usuarios, productos, pedidos, ventas, inventario…). Usa `IF NOT EXISTS`, así no rompe una base que ya existe. |
| 🆕 `migrations/002_sesiones_refresh_token.sql` | Crea la tabla `refresh_tokens`: las sesiones abiertas (cada "familia" es un dispositivo). |
| 🆕 `migrations/003_versiones_para_conflictos.sql` | Agrega `version` y `updated_at` a productos y categorías para detectar conflictos. |
| 🆕 `seeds/001_datos_base.sql` | Datos de ejemplo: categorías, medios de pago, 5 mesas y 5 productos con inventario. |

### 6.3 `Backend/` — el servidor

| Archivo | Para qué sirve |
|---|---|
| ✏️ `package.json` | Librerías del servidor y comandos (`dev`, `start`, `migrate`, `create-user`, `test`…). Se agregaron `zod`, `helmet`, `express-rate-limit` y `cookie-parser`. |
| 🆕 `.env.example` | Modelo del archivo `.env` con explicación de cada variable. |
| `.env` | **Secreto, no se sube.** Contraseña de la base de datos y `JWT_SECRET`. |

#### `Backend/src/` — el código

El backend está organizado **por capas**. Una petición viaja así:

```
routes  →  middlewares  →  controllers  →  services  →  repositories  →  PostgreSQL
(¿qué     (¿tiene sesión?  (recibe y      (reglas del    (consultas
 URL?)     ¿tiene permiso?  responde)      negocio)       SQL)
           ¿datos válidos?)
```

| Archivo | Para qué sirve |
|---|---|
| 🆕 `app.js` | **Arma** la aplicación: pone en orden los middlewares (seguridad, CORS, cookies, límite de peticiones), las rutas y el manejador de errores. En producción también entrega la página web compilada. Se separó de `server.js` para poder probarla sin encender el servidor. |
| ✏️ `server.js` | **Enciende** el servidor: revisa la configuración, aplica migraciones pendientes, programa la limpieza de tokens vencidos y escucha en el puerto. Se apaga ordenadamente con `Ctrl + C`. |

**`config/`** — configuración

| Archivo | Para qué sirve |
|---|---|
| 🆕 `env.js` | Lee el archivo `.env` en un solo lugar y avisa si falta `JWT_SECRET`. |
| ✏️ `database.js` | Crea la conexión con PostgreSQL. Ahora también acepta `DATABASE_URL` (como en la nube). |

**`routes/`** — las direcciones (URL) de la API

| Archivo | Para qué sirve |
|---|---|
| 🆕 `index.js` | Junta todas las rutas. Desde aquí, todo lo que no sea `/health` o `/auth` **exige sesión**. |
| ✏️ `auth.routes.js` | `/api/auth/login`, `/refresh`, `/logout`, `/logout-all`, `/profile`, `/sessions`. |
| ✏️ `products.routes.js` | `/api/products`. Todos ven; solo el admin crea, edita o borra. |
| ✏️ `categories.routes.js` | `/api/categories`. Igual que productos. |
| ✏️ `orders.routes.js` | `/api/orders`. Todos los roles; la propiedad se revisa en el servicio. |
| ✏️ `sales.routes.js` | `/api/sales`. Solo admin y cajero. |
| ✏️ `inventory.routes.js` | `/api/inventory`. Admin y cajero. |
| ✏️ `tables.routes.js` | `/api/tables`. Todos. |
| 🆕 `paymentMethods.routes.js` | `/api/payment-methods`: lista de medios de pago. |
| 🆕 `health.routes.js` | `/api/health`: dice si el servidor y la base de datos funcionan (la nube lo usa para vigilar la app). |

**`middlewares/`** — "filtros" por los que pasa cada petición

| Archivo | Para qué sirve |
|---|---|
| ✏️ `auth.middleware.js` | `authenticate`: revisa el Access Token y que la sesión siga abierta. `authorize('admin', ...)`: revisa el rol. |
| ✏️ `validate.middleware.js` | Valida los datos con los esquemas de Zod antes de llegar al controlador. |
| ✏️ `error.middleware.js` | **Manejador global de errores**: todos los errores terminan aquí y salen con el mismo formato. Nunca muestra detalles técnicos internos. |
| ✏️ `notFound.middleware.js` | Responde 404 si la ruta no existe. |
| 🆕 `correlation.middleware.js` | Pone el `x-correlation-id` y escribe en el log cada petición atendida (método, ruta, código y duración). |
| 🆕 `rateLimit.middleware.js` | Límite de intentos de login y de peticiones por minuto. |

**`controllers/`** — reciben la petición y arman la respuesta

Todos fueron **simplificados**: ya no validan a mano (lo hace Zod) ni deciden
códigos de error (lo hace el manejador global). Solo llaman al servicio y
responden.

| Archivo | Para qué sirve |
|---|---|
| ✏️ `auth.controller.js` | Pone y borra la cookie del Refresh Token con sus protecciones. |
| ✏️ `products.controller.js`, `categories.controller.js`, `orders.controller.js`, `sales.controller.js`, `tables.controller.js`, `inventory.controller.js` | Uno por cada tipo de dato. |

**`services/`** — las reglas del negocio

| Archivo | Para qué sirve |
|---|---|
| ✏️ `auth.service.js` | Login, renovación con rotación, detección de reutilización, límite de sesiones, cerrar sesiones. |
| ✏️ `orders.service.js` | El pedido siempre se crea a nombre del usuario que inició sesión. |
| ✏️ `sales.service.js` | Después de cobrar, encola la revisión de stock bajo. |
| ✏️ `products.service.js`, `categories.service.js`, `tables.service.js` | Devuelven "no encontrado" (404) cuando corresponde. |
| `inventory.service.js` | Consulta del inventario. |

**`repositories/`** — las consultas SQL

| Archivo | Para qué sirve |
|---|---|
| ✏️ `products.repository.js` | Ahora con **bloqueo optimista** (`version`) y todo dentro de transacciones. |
| ✏️ `categories.repository.js` | Igual, con `version`. |
| ✏️ `orders.repository.js` | Crear pedidos sin duplicar (`localId`), máquina de estados y propiedad del pedido. Usa `FOR UPDATE`. |
| ✏️ `sales.repository.js` | Cobro en una sola transacción con `FOR UPDATE`; si no hay stock responde 409 (conflicto). |
| 🆕 `sessions.repository.js` | Consultas de la tabla `refresh_tokens`. |
| ✏️ `inventory.repository.js` | Se agregó la búsqueda de productos con stock bajo. |
| `tables.repository.js`, `users.repository.js` | Mesas y usuarios. |

**`domain/`** — reglas puras (no tocan la base de datos)

| Archivo | Para qué sirve |
|---|---|
| 🆕 `orderRules.js` | La máquina de estados del pedido y la regla de "un mesero solo cambia sus pedidos". Al no tocar la base de datos, es muy fácil de probar. |

**`validators/`**

| Archivo | Para qué sirve |
|---|---|
| 🆕 `schemas.js` | Todos los esquemas de Zod (login, productos, categorías, pedidos, ventas, ids). |

**`utils/`** — herramientas reutilizables

| Archivo | Para qué sirve |
|---|---|
| 🆕 `AppError.js` | Un error que "sabe" su código HTTP: `AppError.notFound(...)`, `AppError.conflict(...)`, etc. |
| 🆕 `logger.js` | Escribe logs en JSON con el `correlationId`. |
| 🆕 `jobQueue.js` | La cola de tareas en memoria con reintentos. |
| 🆕 `tokens.js` | Crea y verifica el Access Token (JWT) y genera y "huellea" (hash) el Refresh Token. |

**`scripts/`** — comandos de ayuda

| Archivo | Comando | Para qué sirve |
|---|---|---|
| 🆕 `migrate.js` | `npm run migrate` | Aplica las migraciones pendientes (y con `-- --seed` los datos de ejemplo). |
| 🆕 `create-user.js` | `npm run create-user -- usuario clave rol "Nombre"` | Crea un usuario o le cambia la contraseña. |
| 🆕 `hash-plain-passwords.js` | `npm run hash-passwords` | Cifra contraseñas que hayan quedado en texto plano. |

#### `Backend/tests/` — pruebas del servidor

| Archivo | Qué prueba |
|---|---|
| 🆕 `unit/orderRules.test.js` | Que los pedidos solo avancen, que la resolución sea determinística y la regla de propiedad. |
| 🆕 `unit/schemas.test.js` | Que Zod rechace precios negativos, HTML, campos extra, inyección SQL en ids, etc. |
| 🆕 `unit/tokens.test.js` | Que un token alterado o firmado con otra clave no sirva. |
| 🆕 `unit/jobQueue.test.js` | Que la cola ejecute, reintente y descarte tareas. |
| 🆕 `unit/errorHandler.test.js` | Que el manejador de errores responda bien y no muestre detalles internos. |
| 🆕 `integration/helpers.js` | Ayudas: enciende la API, crea usuarios de prueba y **borra todo al terminar**. |
| 🆕 `integration/auth.test.js` | Login, cookie segura, rotación, robo de token, logout, cerrar todas las sesiones. |
| 🆕 `integration/permissions-and-conflicts.test.js` | Permisos por rol, propiedad, pedidos sin duplicar, conflictos 409 y stock insuficiente. |

### 6.4 `Frontend/` — la aplicación web

| Archivo | Para qué sirve |
|---|---|
| ✏️ `package.json` | Librerías y comandos (`dev`, `build`, `test:unit`, `test:e2e`). Se agregaron `vitest`, `@vue/test-utils`, `jsdom`, `fake-indexeddb` y `@playwright/test`. |
| ✏️ `vite.config.ts` | Configuración de Vite. Ahora **reenvía `/api` al backend** en desarrollo, para que página y API parezcan estar en el mismo sitio, y configura las pruebas de Vitest. |
| 🆕 `playwright.config.ts` | Configuración de las pruebas de punta a punta: compila la app y enciende el backend en el puerto 3100. |
| ✏️ `index.html` | Página base. Se agregó el manifiesto (para instalar la app). |
| `tsconfig*.json`, `eslint.config.ts`, `.oxlintrc.json`, `.prettierrc.json` | Reglas de TypeScript, de estilo y de revisión de código. |

#### `Frontend/public/` — archivos que se copian tal cual

| Archivo | Para qué sirve |
|---|---|
| ✏️ `sw.js` | El **Service Worker**: guarda la página y sus archivos para abrir sin internet. Nunca guarda datos de `/api`. |
| 🆕 `manifest.webmanifest` | Nombre, colores e ícono para "instalar" la app como si fuera de celular. |
| `favicon.ico` | Ícono de la pestaña. |

#### `Frontend/src/` — el código

| Archivo | Para qué sirve |
|---|---|
| ✏️ `main.ts` | Punto de partida: crea la app, conecta Pinia y el router, abre IndexedDB y registra el Service Worker. |
| ✏️ `App.vue` | Componente principal: arranca la sincronización automática y, si la sesión termina, lleva al login **sin recargar la página**. |

**`router/`**

| Archivo | Para qué sirve |
|---|---|
| ✏️ `index.ts` | Lista de pantallas y qué roles pueden entrar a cada una. El **Navigation Guard es asíncrono**: antes de mostrar una pantalla confirma la sesión (renovándola con la cookie si hace falta) y revisa el rol. |

**`services/`** — hablan con la API (y con IndexedDB si no hay internet)

| Archivo | Para qué sirve |
|---|---|
| 🆕 `session.ts` | Guarda el Access Token **solo en memoria** y sabe renovar la sesión. Si varias peticiones necesitan renovar a la vez, todas esperan **una sola** renovación. |
| ✏️ `api.ts` | Cliente HTTP (axios) con interceptores: agrega el token, renueva la sesión ante un 401 y **reintenta** si falla la red. Tiene funciones para mostrar errores entendibles. |
| ✏️ `products.service.ts` | Productos con modo offline y envío de la `version` para detectar conflictos. |
| ✏️ `categories.service.ts` | Igual para categorías. |
| ✏️ `orders.service.ts` | Pedidos con modo offline. Ahora también se puede **cancelar sin conexión** un pedido que se creó sin conexión. |
| ✏️ `tables.service.ts` | Mesas (con copia local). |
| `sales.service.ts`, `inventory.service.ts` | Ventas e inventario (con copia local). |

**`stores/`** — estado global con Pinia

| Archivo | Para qué sirve |
|---|---|
| ✏️ `auth.ts` | Usuario conectado, rol, login, logout, sesiones. Solo guarda en el navegador el **perfil** (id, nombre, rol), nunca tokens. |
| ✏️ `products.ts` | Productos **normalizados** (por id), con `loading`, `error` y caché de 1 minuto. |
| ✏️ `orders.ts` | **Única fuente de pedidos** para todas las pantallas: normalizados, con `loading`, `error` y caché, y acciones para crear, entregar y cancelar. Antes guardaba pedidos en `localStorage`, separados de la base real. |
| 🆕 `sales.ts` | Ventas y medios de pago: cobrar con o sin conexión y saber si un pedido ya se cobró. |

**`offline/`** — el corazón del Offline-First

| Archivo | Para qué sirve |
|---|---|
| ✏️ `db.ts` | La base de datos del navegador (IndexedDB): copias de los datos, la cola `syncQueue` y el historial `syncLog`. |
| ✏️ `queue.ts` | Agregar, leer, ordenar y reintentar operaciones pendientes. El orden es determinístico (por fecha y luego por id). |
| ✏️ `sync.ts` | El **sincronizador**: envía la cola en orden, reemplaza ids temporales, aplica las reglas de conflicto y permite resolverlos a mano. |
| 🆕 `syncRules.ts` | Las **reglas determinísticas** de la sección 5.7, escritas como funciones fáciles de probar. |
| 🆕 `serviceWorker.ts` | Registra el Service Worker (solo en la versión compilada). |
| 🆕 `__tests__/syncRules.test.ts`, `__tests__/queue.test.ts` | Pruebas unitarias de las reglas y de la cola. |

**`views/`** — las pantallas

| Archivo | Para qué sirve |
|---|---|
| ✏️ `LoginView.vue` | Inicio de sesión, con botón para ver la contraseña y mensajes de error claros. |
| ✏️ `DashboardView.vue` | Resumen del día. Ahora usa las tiendas de Pinia. |
| ✏️ `SalesView.vue` | Punto de venta: crear pedidos y cobrar (también sin internet). Ahora solo arma componentes. |
| ✏️ `OrdersView.vue` | Lista de pedidos, entregar, cancelar y cobrar. Usa los mismos componentes que el punto de venta. |
| ✏️ `TablesView.vue` | Mesas y sus pedidos activos. Ahora se puede entregar o cancelar **sin internet**. |
| ✏️ `ProductsView.vue` | Menú de productos. Ahora funciona sin internet, envía la versión y avisa si hay conflicto. Solo el admin ve los botones de editar. |
| ✏️ `CategoriesView.vue` | Categorías (solo admin), con versión para detectar conflictos. |
| `InventoryView.vue`, `SalesHistoryView.vue` | Inventario e historial de ventas (admin y cajero). |
| ✏️ `SyncView.vue` | Cola pendiente, **panel de conflictos** con botones para decidir, e **historial de resolución**. |
| 🆕 `SessionsView.vue` | "Mis sesiones": ver en qué dispositivos está abierta la cuenta y cerrarlas. |

**Otros**

| Archivo | Para qué sirve |
|---|---|
| ✏️ `layouts/MainLayout.vue` | Menú lateral (**solo muestra opciones según el rol**), barra superior con el título de la pantalla y estado de conexión. |
| `components/StatCard.vue` | Tarjeta de estadística del panel. |
| 🆕 `components/orders/OrdersTable.vue` | Tabla de pedidos con sus botones. No hace nada por sí sola: **avisa** (emite) a la pantalla cuando se hace clic. |
| 🆕 `components/orders/NewOrderModal.vue` | Ventana para registrar un pedido nuevo (mesa, carrito y observaciones). |
| 🆕 `components/orders/SaleModal.vue` | Ventana para cobrar: total y medio de pago. |
| 🆕 `components/orders/OrdersSummary.vue` | Las tres tarjetas de resumen de pedidos. |
| 🆕 `components/orders/__tests__/` | Pruebas de los componentes (se montan y se les hace clic, como lo haría una persona). |
| 🆕 `composables/useCart.ts` | El carrito del pedido nuevo (agregar, sumar, restar, total). |
| 🆕 `composables/useOrderActions.ts` | Entregar, cancelar y cobrar, con sus mensajes. Antes estaba copiado en dos pantallas. |
| 🆕 `composables/__tests__/useCart.test.ts` | Pruebas del carrito. |
| 🆕 `utils/format.ts` | Mostrar dinero (`$ 18.000`), fechas y el estado del pedido en español. |
| 🆕 `types/models.ts` | Los **tipos** de TypeScript (Usuario, Producto, Pedido…). Gracias a ellos no queda ningún `any`. |
| `assets/styles.css` | Estilos generales. |

#### `Frontend/e2e/` — pruebas de punta a punta

| Archivo | Para qué sirve |
|---|---|
| 🆕 `global-setup.ts` | Antes de las pruebas aplica migraciones y crea los usuarios `e2e_admin` y `e2e_mesero`. |
| 🆕 `offline-flow.spec.ts` | Abre Chrome de verdad y prueba: tokens no expuestos, sesión al recargar, **pedido sin internet que se sincroniza solo** y que un mesero no vea opciones de admin. |

---

## 7. Las pruebas automáticas

| Tipo | Cantidad | Comando | Qué necesita |
|---|---|---|---|
| Backend unitarias + integración | 49 | `cd Backend && npm test` | PostgreSQL encendido (las de integración se saltan si no hay base) |
| Frontend unitarias y de componentes | 36 | `cd Frontend && npm run test:unit` | Nada |
| Punta a punta (E2E) | 4 | `cd Frontend && npm run test:e2e` | PostgreSQL y Chrome de Playwright (`npx playwright install chromium` la primera vez) |
| Revisión de tipos | — | `cd Frontend && npm run type-check` | Nada |

- Las pruebas de integración crean usuarios que empiezan por `test_` y **los
  borran al terminar**.
- Las pruebas E2E dejan los usuarios `e2e_admin` / `e2e_mesero` y los pedidos de
  prueba en la base. Si no quiere eso, use una base aparte cambiando `DB_NAME`.
- En GitHub, `.github/workflows/ci.yml` corre todo esto automáticamente con una
  base de datos limpia.

---

## 8. Cómo subirlo a la nube

La aplicación **ya está publicada** en Render:
**https://pos-restaurante-y2m9.onrender.com**

Cómo se hizo (por si hay que repetirlo):

1. En https://render.com, iniciar sesión con GitHub.
2. **New → Blueprint**, elegir el repositorio y la rama.
3. Render lee `render.yaml` y crea la base de datos (`pos-db`) y el servicio
   web (`pos-restaurante`).
4. En el servicio, pestaña **Environment**, crear `ADMIN_USERNAME` y
   `ADMIN_PASSWORD`. Al arrancar, el servidor crea ese administrador si no
   existe (así no se necesita la consola de Render, que es de pago).
5. Cada vez que se suben cambios a la rama elegida, Render vuelve a
   desplegar solo.

**¿Por qué un solo servicio?** El backend entrega también la página compilada.
Así página y API tienen **la misma dirección** y la cookie `SameSite=Strict`
funciona sin trucos.

> El plan gratuito "duerme" el servicio si no se usa: la primera visita puede
> tardar unos 50 segundos. La base de datos gratuita de Render vence después de
> un tiempo; revisar la fecha en el panel de `pos-db`.

---

## 9. Lo que todavía queda por hacer

1. **Pull Requests.** Unir `M_Frontend` → `develop` → `main` con Pull Requests
   revisados por el equipo. Al abrirlos, GitHub corre todas las pruebas
   automáticamente (`.github/workflows/ci.yml`). Después, en Render, cambiar la
   rama del Blueprint a `main`.
2. **Tablas sin usar.** La base tiene tablas que la aplicación no usa
   (`devices`, `sync_operations`, `sync_conflicts`, cajas registradoras,
   ingredientes, recetas). Se pueden presentar como trabajo futuro.
3. **Contraseñas de `mesero2` y `cajero2`** (solo en la base local de
   Sebastián): se cifraron sus valores de prueba antiguos, que nadie conoce.
   Si se necesitan, se cambian con `npm run create-user`.

El guion para la sustentación está en [GUION_SUSTENTACION.md](GUION_SUSTENTACION.md).

---

## 10. Glosario

| Palabra | Significado sencillo |
|---|---|
| **API** | La "ventanilla" del servidor: direcciones (URL) a las que el frontend pide o envía datos. |
| **Backend / Frontend** | Servidor (lo que no se ve) / aplicación en el navegador (lo que se ve). |
| **Middleware** | Función por la que pasa una petición antes de llegar a su destino (como un control de seguridad). |
| **JWT** | Un tipo de token firmado digitalmente; si alguien lo cambia, la firma deja de coincidir. |
| **Cookie HttpOnly** | Dato que el navegador guarda y envía solo, pero que el JavaScript de la página no puede leer. |
| **Hash** | "Huella" de un texto: siempre da lo mismo para el mismo texto, pero no se puede devolver al original. |
| **bcrypt** | Forma lenta y segura de hacer hash de contraseñas. |
| **RBAC** | Control de acceso basado en roles (admin, cajero, mesero). |
| **XSS** | Ataque que mete código JavaScript malicioso en una página. |
| **CSRF** | Ataque donde otra página hace que el navegador envíe peticiones sin que el usuario lo sepa. |
| **Inyección SQL** | Ataque que mete comandos SQL dentro de un dato. |
| **Transacción (ACID)** | Grupo de operaciones que se hacen todas o ninguna. |
| **Idempotente** | Que hacerlo dos veces da el mismo resultado que hacerlo una vez. |
| **IndexedDB** | Base de datos que vive dentro del navegador. |
| **Service Worker** | Programa que el navegador mantiene instalado y que puede entregar la página sin internet. |
| **Migración** | Archivo SQL numerado que cambia la estructura de la base de datos de forma ordenada. |
| **Determinístico** | Que ante la misma situación siempre da el mismo resultado. |
| **CI** | Integración continua: correr las pruebas automáticamente en cada cambio. |
| **E2E** | Prueba "de punta a punta": usa la aplicación completa como lo haría una persona. |
| **409 / 401 / 403 / 404** | Códigos HTTP: conflicto / no hay sesión / sin permiso / no existe. |
