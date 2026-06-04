# @smdv/middleware

Estandarización de **autenticación**, **formato de respuesta** y **manejo de errores** para todos los microservicios Smart Sale.

## ¿Por qué existe este paquete?

El sistema tenía tres patrones distintos para extraer la identidad del usuario:

| Patrón anterior | Problema |
|---|---|
| `jwtDecode(token)` en middleware | Decodifica sin verificar firma — falsa seguridad |
| `request.header('owner-id')` solo | Extrae solo `ownerId`, obliga doble acceso al JWT en managers |
| `request.body.ownerId = ownerId` | Contamina el body con datos de auth |

Este paquete estandariza en un único patrón: el middleware extrae **todos** los campos del contexto de autenticación desde los headers inyectados por KrakenD y los expone en `request.authContext`.

## Dos modos de operación

### `gateway-trust` (default — sin JWT_KEY en el servicio)

```
Client → KrakenD → ms-core-auth /auth/verify-session (jwt.verify aquí)
                 → inyecta headers: owner-id, user-id, role-id…
                 → Microservicio lee headers (ya verificados)
```

El gateway es la única capa de verificación. Correcto cuando los microservicios son **inaccesibles desde fuera del cluster** (security groups, K8s Network Policies). No requiere distribuir `JWT_KEY`.

### `jwt-verify` (defensa en profundidad — requiere JWT_KEY)

```
Client → KrakenD → [verifica JWT] → Microservicio → [verifica JWT de nuevo]
                                                     ↑ detecta tokens forjados
                                                       aunque eviten el gateway
```

Verifica la firma del JWT con `jsonwebtoken.verify()` en cada servicio. Protege contra:
- Llamadas pod-a-pod dentro de K8s que eluden el gateway
- Security groups mal configurados que exponen puertos internos

Requiere agregar `JWT_KEY` al secreto de cada servicio en AWS Secrets Manager.

**Cuál usar:** empieza con `gateway-trust`. Migra a `jwt-verify` en los servicios que manejan datos críticos (payments, orders) o si los microservicios son alcanzables desde dentro del cluster sin pasar por el gateway.

## Instalación

```bash
npm install @smdv/middleware
```

## Uso

### AdonisJS v5 (mayoría de servicios)

**1. Reemplazar `app/Middleware/Authorization.ts`:**

```typescript
// app/Middleware/Authorization.ts — modo gateway-trust (default)
export { AuthorizationMiddleware as default } from '@smdv/middleware'

// --- O con jwt-verify (defensa en profundidad) ---
import Env from '@ioc:Adonis/Core/Env'
import { AuthorizationMiddleware } from '@smdv/middleware'

export default new AuthorizationMiddleware({
  mode: 'jwt-verify',
  jwtKey: Env.get('JWT_KEY'),
})
```

> Para `jwt-verify` agregar `JWT_KEY` al secreto `dev/{servicio}` en AWS Secrets Manager.

**2. El registro en `start/kernel.ts` no cambia** (ya referencia el archivo).

**3. Agregar type augmentation en `contracts/request.ts`** (opcional pero recomendado):

```typescript
// contracts/request.ts
import '@ioc:Adonis/Core/Request'
import { AuthContext } from '@smdv/middleware'

declare module '@ioc:Adonis/Core/Request' {
  interface RequestContract {
    authContext: AuthContext
  }
}
```

**4. Actualizar acceso en Managers/Controllers:**

```typescript
// ANTES — dos fuentes distintas, double decode
import jwtDecode from 'jwt-decode'
const tokenObject: any = jwtDecode(request.header('Authorization') as string)
const ownerId   = tokenObject.ownerId          // del JWT decode
const userId    = tokenObject.userId
const ownerId2  = request.input('ownerId')     // del body (contaminado por middleware)

// DESPUÉS — una sola fuente
const { ownerId, userId, employeeId, fullUserName } = (request as any).authContext
```

---

### AdonisJS v6 (ms-sale-warehouse)

```typescript
// app/middleware/authorization_middleware.ts
export { AuthorizationMiddlewareV6 as default } from '@smdv/middleware'
```

Acceso en handlers:

```typescript
import { AuthContext } from '@smdv/middleware'

async index({ request }: HttpContext) {
  const { ownerId } = (request as any).authContext as AuthContext
}
```

---

### NestJS (ms-billing-subscriptions, ms-reports)

```typescript
// src/auth/auth.guard.ts
export { AuthGuard } from '@smdv/middleware'

// Uso en controlador
@UseGuards(AuthGuard)
@Controller('subscriptions')
export class SubscriptionsController {
  @Get()
  findAll(@Req() req: Request & { authContext: AuthContext }) {
    const { ownerId } = req.authContext
  }
}
```

---

## AuthContext — referencia de campos

| Campo | Header origen | Descripción |
|---|---|---|
| `ownerId` | `owner-id` | ID del tenant/empresa dueña del recurso |
| `userId` | `user-id` | ID del usuario autenticado |
| `roleId` | `role-id` | ID del rol del usuario |
| `employeeId` | `employee-id` | ID del empleado (puede ser vacío) |
| `enterpriseId` | `enterprise-id` | ID de la empresa en la que opera |
| `fullUserName` | `full-user-name` | Nombre completo del usuario |
| `ownerName` | `owner-name` | Nombre del tenant |
| `roleName` | `role-name` | Nombre del rol |

Todos los campos vienen de los headers inyectados por `ms-gateway/main.go`.

---

## Llamadas servicio a servicio

Cuando un servicio llama a otro, debe propagar **todos** los headers de autenticación:

```typescript
// helpers/forwardAuthHeaders.ts
import { AuthContext } from '@smdv/middleware'

export function forwardAuthHeaders(ctx: AuthContext): Record<string, string> {
  return {
    'owner-id':       ctx.ownerId,
    'user-id':        ctx.userId,
    'role-id':        ctx.roleId,
    'employee-id':    ctx.employeeId,
    'enterprise-id':  ctx.enterpriseId,
    'full-user-name': ctx.fullUserName,
    'owner-name':     ctx.ownerName,
    'role-name':      ctx.roleName,
  }
}
```

```typescript
// Uso en un Manager
import axios from 'axios'
import { forwardAuthHeaders } from '../helpers/forwardAuthHeaders'

const { authContext } = request as any
await axios.post(MS_BUSINESS_URL + '/api/business/shopping/product-details/sale', payload, {
  headers: {
    Authorization: request.header('Authorization'),
    ...forwardAuthHeaders(authContext),
  },
})
```

---

## Formato de respuesta — `ApiResponse<T>`

Contrato único para **todos** los servicios:

```typescript
// Éxito
{ success: true,  message: string, response: T }

// Error
{ success: false, message: string, errors?: unknown }
```

### Helpers de respuesta

```typescript
import {
  okResponse, createdResponse, updatedResponse, deletedResponse,
  badRequestResponse, notFoundResponse, unprocessableResponse,
  unauthorizedResponse, internalErrorResponse,
} from '@smdv/middleware'

// En un manager/controller AdonisJS
async index({ response }: HttpContext) {
  const items = await ItemRepository.list(ownerId)
  return response.ok(okResponse(items))
}

async store({ request, response }: HttpContext) {
  try {
    const item = await ItemRepository.create(request.body())
    return response.created(createdResponse(item))
  } catch (err: any) {
    return response.badRequest(badRequestResponse(err.message, err.errors))
  }
}
```

### Antes vs después

```typescript
// ANTES — shape inconsistente entre servicios
return response.ok({ success: true, message: 'ok', response: data })          // warehouse
return response.created({ success: true, message: 'Pago procesado', response: {...} }) // payments
return response.notFound({ success: false, message: error?.message })          // attachment
return response.ok({ error: true, status: 'error' })                           // admin (distinto!)

// DESPUÉS — una sola forma
return response.ok(okResponse(data))
return response.created(createdResponse(data, 'Pago procesado correctamente'))
return response.notFound(notFoundResponse('Recurso no encontrado'))
return response.badRequest(badRequestResponse('Error de validación', errors))
```

---

## Exception Handler — errores no capturados

El `ExceptionHandler` es el equivalente AdonisJS al middleware de error de Express. Intercepta **cualquier excepción no capturada** en controllers/managers y la formatea como `ApiResponse`.

### AdonisJS v5

```typescript
// app/Exceptions/Handler.ts
import { ExceptionHandlerV5 } from '@smdv/middleware'
import { logger } from '@smdv/logwise'

export default class ExceptionHandler extends ExceptionHandlerV5 {
  constructor() {
    super(process.env.NODE_ENV !== 'production', logger) // debug=true en dev
  }
}
```

### AdonisJS v6

```typescript
// app/exceptions/handler.ts
import { ExceptionHandlerV6 } from '@smdv/middleware'
import { logger } from '@smdv/logwise'
import app from '@adonisjs/core/services/app'

export default new ExceptionHandlerV6(!app.inProduction, logger)
```

### Qué captura automáticamente

| Código AdonisJS | HTTP | Respuesta |
|---|---|---|
| Instancia de `ApiError` | `error.statusCode` | `{ success: false, message, errors }` (usa `error.isOperational`) |
| `E_VALIDATION_FAILURE` | 422 | `{ success: false, message: 'Error de validación', errors: [...] }` |
| `E_ROW_NOT_FOUND` | 404 | `{ success: false, message: 'Recurso no encontrado' }` |
| `E_UNAUTHORIZED_ACCESS` | 401 | `{ success: false, message: 'No autorizado' }` |
| Errores 4xx explícitos | 4xx | `{ success: false, message: error.message }` |
| Cualquier otro | 500 | `{ success: false, message: 'Error interno del servidor' }` |

**En producción** — el stack trace nunca llega al cliente. Solo se loggea internamente.

> Inyectar logger (recomendado): `new ExceptionHandlerV6(!app.inProduction, logger)` — usa el `logger` de `@smdv/logwise` para que CloudWatch reciba el campo `service` automáticamente.

---

## Errores tipados y respuestas (ex-logwise)

Migrado desde `@smdv/logwise` para separar **logging** (logwise) de **formato HTTP** (middleware). Ver [docs/MIDDLEWARE-MIGRATION.md](../../docs/MIDDLEWARE-MIGRATION.md).

### Clases de error tipadas

```typescript
import {
  ApiError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  UnprocessableEntityError,
  TooManyRequestsError,
  InternalServerError,
  ServiceUnavailableError,
  DatabaseError,
  ExternalServiceError,
} from '@smdv/middleware'

// En un Manager — lanzar y dejar que ExceptionHandler responda
if (!owner) throw new NotFoundError('Cliente no encontrado')
if (order.ownerId !== ctx.ownerId) throw new ForbiddenError()
if (errors.length) throw new ValidationError('Datos inválidos', errors)
```

Cada clase trae `statusCode` y `code` predefinidos (`ERROR_CODES`) y se serializa con shape `ApiResponse`.

### `handleError` — clasificador framework-agnostic

Útil cuando necesitas convertir un error a `{ status, body }` sin pasar por `ExceptionHandler` (controllers que capturan localmente, lambdas, etc.):

```typescript
import { handleError } from '@smdv/middleware'
import { logger } from '@smdv/logwise'

try {
  await processPayment(payload)
} catch (err) {
  const { status, body } = handleError(err, logger, 'ms-core-payments')
  return response.status(status).json(body)
}
```

Detecta automáticamente: `ApiError`, MySQL (`ER_DUP_ENTRY`, `ER_NO_REFERENCED_ROW`), Adonis (`ValidationException`, `ModelNotFoundException`), Mongoose (`ValidationError`, `CastError`), JWT (`JsonWebTokenError`, `TokenExpiredError`).

### Constantes y helpers HTTP

```typescript
import {
  HTTP_OK, HTTP_CREATED, HTTP_BAD_REQUEST, HTTP_NOT_FOUND,
  HTTP_INTERNAL_SERVER_ERROR,
  isSuccessCode, isClientError, isServerError,
  ERROR_CODES,
  Messages, getMessage,
  HttpStatus, SupportedLang,
} from '@smdv/middleware'
```

`getMessage(SupportedLang.ES, 'NOT_FOUND')` → mensaje localizado (es/en).

### Helpers Express (opcional)

```typescript
import { createErrorHandler, asyncHandler, notFoundHandler } from '@smdv/middleware'

app.use(notFoundHandler())
app.use(createErrorHandler({ logger }))
app.get('/items', asyncHandler(async (req, res) => { ... }))
```

> Express se importa con `import type` — el paquete funciona en servicios que no lo usan.

---

## Guía de migración por servicio

| Servicio | Patrón anterior | Acción |
|---|---|---|
| ms-core-admin | Header-only | Reemplazar con `AuthorizationMiddleware` |
| ms-core-customer | Header-only | Reemplazar con `AuthorizationMiddleware` |
| ms-core-attachment | Header-only | Reemplazar con `AuthorizationMiddleware` |
| ms-core-notifications | Header-only | Reemplazar con `AuthorizationMiddleware` |
| ms-core-payments | jwtDecode | Reemplazar + quitar import `jwt-decode` |
| ms-sale-orders | jwtDecode | Reemplazar + actualizar `OrdersManager.ts` |
| ms-sale-business | Header-only | Reemplazar + actualizar `ShoppingManager.ts` |
| ms-sale-orders-history | Header-multi | Reemplazar (ya extrae employee-id y full-user-name) |
| ms-sale-orders-tracking | jwtDecode | Reemplazar |
| ms-sale-warehouse | Header-only (v6) | Reemplazar con `AuthorizationMiddlewareV6` |
| ms-chat-flow-manager | jwtDecode | Reemplazar |
| ms-chat-desition-tree | jwtDecode | Reemplazar |
| ms-chat-widget-generator | jwtDecode | Reemplazar |
| ms-billing-subscriptions | (verificar) | Usar `AuthGuard` |
| ms-reports | (verificar) | Usar `AuthGuard` |

---

## Build

```bash
npm run build   # genera dist/
npm pack        # genera .tgz para instalación local
```
