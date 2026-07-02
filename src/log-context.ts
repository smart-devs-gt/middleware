import { AsyncLocalStorage } from 'async_hooks'

/**
 * Contexto de log por request — lado middleware.
 *
 * Comparte la MISMA instancia de AsyncLocalStorage que `@smdv/logwise` a través
 * del registro global de símbolos (`Symbol.for('@smdv/log-context')`). Por eso
 * middleware NO necesita depender de logwise: ambos paquetes resuelven el mismo
 * store por la clave global. El auth middleware abre el contexto con el `ownerId`
 * (clave de tenant, ADR-003) y logwise lo mezcla en cada log automáticamente.
 *
 * Si logwise no está instalado, esto sigue funcionando como un ALS aislado
 * (no rompe nada; simplemente nadie lee el contexto).
 */
export type LogContext = Record<string, string | number | boolean | undefined>

const STORE_KEY = Symbol.for('@smdv/log-context')

function getStore(): AsyncLocalStorage<LogContext> {
  const g = globalThis as unknown as Record<symbol, AsyncLocalStorage<LogContext>>
  if (!g[STORE_KEY]) {
    g[STORE_KEY] = new AsyncLocalStorage<LogContext>()
  }
  return g[STORE_KEY]
}

/** Ejecuta `fn` con un contexto de log activo (hereda el padre si existe). */
export function runWithLogContext<T>(context: LogContext, fn: () => T): T {
  const store = getStore()
  const parent = store.getStore()
  const merged: LogContext = { ...(parent || {}), ...context }
  return store.run(merged, fn)
}

/** Devuelve el contexto de log activo (o undefined fuera de un request). */
export function getLogContext(): LogContext | undefined {
  return getStore().getStore()
}

/**
 * Campos de tenant/usuario que se propagan a los logs desde el authContext.
 * Solo se incluyen los presentes (evita campos vacíos en cada línea).
 */
export function logContextFromAuth(ctx: {
  ownerId?: string
  userId?: string
  enterpriseId?: string
}): LogContext {
  const out: LogContext = {}
  if (ctx.ownerId) out.ownerId = ctx.ownerId
  if (ctx.userId) out.userId = ctx.userId
  if (ctx.enterpriseId) out.enterpriseId = ctx.enterpriseId
  return out
}

/**
 * Middleware estilo Express/Connect para NestJS (y cualquier app Express).
 *
 * En NestJS un Guard NO puede establecer contexto ALS para el handler (su
 * `canActivate` solo retorna boolean; no envuelve el downstream). Para esos
 * servicios se usa este middleware con `app.use(logContextMiddleware())`, que
 * sí envuelve toda la cadena (guards + handler) dentro del `run()`.
 *
 * Lee `owner-id`/`user-id`/`enterprise-id` de los headers inyectados por el
 * gateway (modo gateway-trust). Si no hay `owner-id`, no abre contexto y deja
 * pasar (la autorización es responsabilidad del AuthGuard, no de este middleware).
 */
export function logContextMiddleware() {
  return function (req: any, _res: any, next: () => void): void {
    const headers: Record<string, any> = req?.headers ?? {}
    const pick = (k: string): string | undefined => {
      const v = headers[k]
      return Array.isArray(v) ? v[0] : (v as string | undefined)
    }
    const ownerId = pick('owner-id')
    if (!ownerId) {
      next()
      return
    }
    runWithLogContext(
      logContextFromAuth({
        ownerId,
        userId: pick('user-id'),
        enterpriseId: pick('enterprise-id'),
      }),
      () => next(),
    )
  }
}
