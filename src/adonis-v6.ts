import { buildAuthContextFromHeaders, buildAuthContextFromJwt } from './context'
import { AuthMiddlewareOptions } from './types'
import { runWithLogContext, logContextFromAuth } from './log-context'

type AdonisHttpContext = {
  request: {
    header(key: string): string | undefined
    headers(): Record<string, string | string[] | undefined>
  }
  response: { unauthorized(body: unknown): void }
}
type NextFn = () => Promise<unknown>

const DEFAULT_MSG = 'Unauthorized'

/**
 * Middleware de autorización para AdonisJS v6.
 * Soporta los mismos modos que AuthorizationMiddleware (v5).
 * Ver docs en adonis-v5.ts.
 */
export default class AuthorizationMiddlewareV6 {
  private opts: Required<AuthMiddlewareOptions>

  constructor(options: AuthMiddlewareOptions = {}) {
    this.opts = {
      mode:                 options.mode                 ?? 'gateway-trust',
      jwtKey:               options.jwtKey               ?? '',
      unauthorizedMessage:  options.unauthorizedMessage  ?? DEFAULT_MSG,
    }
  }

  async handle({ request, response }: AdonisHttpContext, next: NextFn) {
    if (this.opts.mode === 'jwt-verify') {
      const result = buildAuthContextFromJwt(
        request.header('authorization'),
        this.opts.jwtKey,
      )
      if (!result.ok) {
        return response.unauthorized({ message: this.opts.unauthorizedMessage })
      }
      ;(request as any).authContext = result.ctx
    } else {
      const ownerId = request.header('owner-id')
      if (!ownerId) {
        return response.unauthorized({ message: this.opts.unauthorizedMessage })
      }
      ;(request as any).authContext = buildAuthContextFromHeaders(request.headers())
    }

    // Abre el contexto de log con la identidad del tenant (ver log-context.ts).
    const ctx = (request as any).authContext
    await runWithLogContext(logContextFromAuth(ctx), () => next())
  }
}
