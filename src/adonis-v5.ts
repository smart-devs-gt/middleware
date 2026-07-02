import { buildAuthContextFromHeaders, buildAuthContextFromJwt } from './context'
import { AuthMiddlewareOptions } from './types'
import { runWithLogContext, logContextFromAuth } from './log-context'

const DEFAULT_MSG = 'Unauthorized'

/**
 * Middleware de autorización para AdonisJS v5.
 *
 * Modo gateway-trust (default) — sin JWT_KEY en el servicio:
 *   Lee los headers inyectados por KrakenD. El JWT ya fue verificado
 *   por el gateway antes de llegar acá.
 *
 * Modo jwt-verify — con JWT_KEY en Secrets Manager:
 *   Verifica la firma del JWT. Rechaza tokens expirados o forjados
 *   aunque el request haya evitado el gateway (defensa en profundidad).
 *
 * Registro en start/kernel.ts:
 *   Server.middleware.registerNamed({
 *     authorization: () => import('@smdv/middleware/dist/adonis-v5'),
 *   })
 *
 * Instanciación con jwt-verify:
 *   // start/kernel.ts
 *   import Env from '@ioc:Adonis/Core/Env'
 *   import { AuthorizationMiddleware } from '@smdv/middleware'
 *   export const authMiddleware = new AuthorizationMiddleware({
 *     mode: 'jwt-verify',
 *     jwtKey: Env.get('JWT_KEY'),
 *   })
 */
export default class AuthorizationMiddleware {
  private opts: Required<AuthMiddlewareOptions>

  constructor(options: AuthMiddlewareOptions = {}) {
    this.opts = {
      mode:                 options.mode                 ?? 'gateway-trust',
      jwtKey:               options.jwtKey               ?? '',
      unauthorizedMessage:  options.unauthorizedMessage  ?? DEFAULT_MSG,
    }
  }

  public async handle({ request, response }: any, next: () => Promise<void>) {
    if (this.opts.mode === 'jwt-verify') {
      const result = buildAuthContextFromJwt(
        request.header('authorization') as string | undefined,
        this.opts.jwtKey,
      )
      if (!result.ok) {
        return response.status(401).send({ message: this.opts.unauthorizedMessage })
      }
      ;(request as any).authContext = result.ctx
    } else {
      // gateway-trust
      const ownerId = request.header('owner-id') as string | undefined
      if (!ownerId) {
        return response.status(401).send({ message: this.opts.unauthorizedMessage })
      }
      ;(request as any).authContext = buildAuthContextFromHeaders(request.headers())
    }

    // Abre el contexto de log con la identidad del tenant para que logwise
    // incluya ownerId/userId/enterpriseId en cada línea del request.
    const ctx = (request as any).authContext
    await runWithLogContext(logContextFromAuth(ctx), () => next())
  }
}
