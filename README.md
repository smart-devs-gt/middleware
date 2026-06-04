# @smdv/middleware

Estandarización de **autenticación**, **formato de respuesta** y **manejo de errores** para microservicios Node.js (AdonisJS v5/v6, NestJS).

## Dos modos de operación

### `gateway-trust` (default)

```
Client → API Gateway → Auth Service (jwt.verify aquí)
                    → inyecta headers: owner-id, user-id, role-id…
                    → Microservicio lee headers (ya verificados)
```

El gateway es la única capa de verificación. Correcto cuando los microservicios son **inaccesibles desde fuera del cluster**. No requiere distribuir `JWT_KEY` a cada servicio.

### `jwt-verify` (defensa en profundidad)

```
Client → API Gateway → [verifica JWT] → Microservicio → [verifica JWT de nuevo]
                                                         ↑ detecta tokens forjados
                                                           aunque eviten el gateway
```

Verifica la firma del JWT con `jsonwebtoken.verify()` en cada servicio. Protege contra llamadas internas que eluden el gateway.

**Cuál usar:** empieza con `gateway-trust`. Migra a `jwt-verify` en servicios críticos (pagos, órdenes) o si los microservicios son accesibles desde dentro del cluster sin pasar por el gateway.

---

## Instalación

```bash
npm install @smdv/middleware
```

---

## Uso

### AdonisJS v5

**1. `app/Middleware/Authorization.ts`:**

```typescript
// Modo gateway-trust (default)
export { AuthorizationMiddleware as default } from '@smdv/middleware'

// --- O con jwt-verify ---
import Env from '@ioc:Adonis/Core/Env'
import { AuthorizationMiddleware } from '@smdv/middleware'

export default new AuthorizationMiddleware({
  mode: 'jwt-verify',
  jwtKey: Env.get('JWT_KEY'),
})
```

**2. Registro en `start/kernel.ts`** (sin cambios si ya tienes `authorization` registrado):

```typescript
Server.middleware.registerNamed({
  authorization: () => import('App/Middleware/Authorization'),
})
```

**3. Type augmentation en `contracts/request.ts`** (opcional pero recomendado):

```typescript
import '@ioc:Adonis/Core/Request'
import { AuthContext } from '@smdv/middleware'

declare module '@ioc:Adonis/Core/Request' {
  interface RequestContract {
    authContext: AuthContext
  }
}
```

**4. Acceso en managers/controllers:**

```typescript
const { ownerId, userId, roleId, employeeId } = (request as any).authContext
```

---

### AdonisJS v6

```typescript
// app/middleware/authorization_middleware.ts
export { AuthorizationMiddlewareV6 as default } from '@smdv/middleware'
```

```typescript
import { AuthContext } from '@smdv/middleware'

async index({ request }: HttpContext) {
  const { ownerId } = (request as any).authContext as AuthContext
}
```

---

### NestJS

```typescript
// src/auth/auth.guard.ts
export { AuthGuard } from '@smdv/middleware'
```

```typescript
@UseGuards(AuthGuard)
@Controller('items')
export class ItemsController {
  @Get()
  findAll(@Req() req: Request & { authContext: AuthContext }) {
    const { ownerId } = req.authContext
  }
}
```

---

## AuthContext — campos disponibles

| Campo | Header origen | Descripción |
|---|---|---|
| `ownerId` | `owner-id` | ID del tenant/dueño del recurso |
| `userId` | `user-id` | ID del usuario autenticado |
| `roleId` | `role-id` | ID del rol del usuario |
| `employeeId` | `employee-id` | ID del empleado (puede ser vacío) |
| `enterpriseId` | `enterprise-id` | ID de la empresa en la que opera |
| `fullUserName` | `full-user-name` | Nombre completo del usuario |
| `ownerName` | `owner-name` | Nombre del tenant |
| `roleName` | `role-name` | Nombre del rol |

---

## Llamadas servicio a servicio

Cuando un servicio llama a otro, propaga todos los headers de autenticación:

```typescript
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
const { authContext } = request as any
await axios.post(OTHER_SERVICE_URL + '/api/resource', payload, {
  headers: forwardAuthHeaders(authContext),
})
```

---

## Formato de respuesta — `ApiResponse<T>`

```typescript
// Éxito
{ success: true,  message: string, response: T }

// Error
{ success: false, message: string, errors?: unknown }
```

### Helpers

```typescript
import {
  okResponse, createdResponse, updatedResponse, deletedResponse,
  badRequestResponse, notFoundResponse, unprocessableResponse,
  unauthorizedResponse, internalErrorResponse,
} from '@smdv/middleware'

return response.ok(okResponse(items))
return response.created(createdResponse(item))
return response.notFound(notFoundResponse('Recurso no encontrado'))
return response.badRequest(badRequestResponse('Error de validación', errors))
```

---

## Exception Handler

### AdonisJS v5

```typescript
// app/Exceptions/Handler.ts
import { ExceptionHandlerV5 } from '@smdv/middleware'

export default class ExceptionHandler extends ExceptionHandlerV5 {
  constructor() {
    super(process.env.NODE_ENV !== 'production') // debug=true en dev
  }
}
```

Con logger personalizado:

```typescript
import { createCustomLogger } from '@smdv/logwise'

const logger = createCustomLogger({ service: process.env.APP_NAME || 'my-service' })

export default class ExceptionHandler extends ExceptionHandlerV5 {
  constructor() {
    super(process.env.NODE_ENV !== 'production', logger)
  }
}
```

### AdonisJS v6

```typescript
// app/exceptions/handler.ts
import { ExceptionHandlerV6 } from '@smdv/middleware'
import app from '@adonisjs/core/services/app'

export default new ExceptionHandlerV6(!app.inProduction)
```

### Qué captura automáticamente

| Código | HTTP | Respuesta |
|---|---|---|
| Instancia de `ApiError` | `error.statusCode` | `{ success: false, message, errors }` |
| `E_VALIDATION_FAILURE` | 422 | `{ success: false, message: 'Error de validación', errors: [...] }` |
| `E_ROW_NOT_FOUND` | 404 | `{ success: false, message: 'Recurso no encontrado' }` |
| `E_UNAUTHORIZED_ACCESS` | 401 | `{ success: false, message: 'No autorizado' }` |
| Errores 4xx explícitos | 4xx | `{ success: false, message: error.message }` |
| Cualquier otro | 500 | `{ success: false, message: 'Error interno del servidor' }` |

---

## Errores tipados

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

// Lanzar y dejar que ExceptionHandler responda
if (!item) throw new NotFoundError('Recurso no encontrado')
if (item.ownerId !== ctx.ownerId) throw new ForbiddenError()
if (errors.length) throw new ValidationError('Datos inválidos', errors)
```

### `handleError` — framework-agnostic

```typescript
import { handleError } from '@smdv/middleware'

try {
  await processPayment(payload)
} catch (err) {
  const { status, body } = handleError(err, logger, 'my-service')
  return response.status(status).json(body)
}
```

Detecta: `ApiError`, MySQL (`ER_DUP_ENTRY`, `ER_NO_REFERENCED_ROW`), Adonis (`ValidationException`, `ModelNotFoundException`), Mongoose, JWT.

### Constantes HTTP y helpers de mensajes

```typescript
import {
  HTTP_OK, HTTP_CREATED, HTTP_BAD_REQUEST, HTTP_NOT_FOUND,
  HTTP_INTERNAL_SERVER_ERROR,
  isSuccessCode, isClientError, isServerError,
  ERROR_CODES,
  Messages, getMessage,
  HttpStatus, SupportedLang,
} from '@smdv/middleware'

getMessage(SupportedLang.ES, 'NOT_FOUND') // → mensaje localizado (es/en)
```

### Helpers Express

```typescript
import { createErrorHandler, asyncHandler, notFoundHandler } from '@smdv/middleware'

app.use(notFoundHandler())
app.use(createErrorHandler({ logger }))
app.get('/items', asyncHandler(async (req, res) => { ... }))
```

---

## Build

```bash
npm run build   # genera dist/
npm pack        # genera .tgz para instalación local
```
