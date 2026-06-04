import { buildAuthContextFromHeaders, buildAuthContextFromJwt } from './context'
import { AuthContext, AuthMiddlewareOptions } from './types'

type CanActivate = { canActivate(context: any): boolean | Promise<boolean> }

/**
 * Guard de NestJS equivalente al middleware AdonisJS.
 * Soporta los mismos modos gateway-trust y jwt-verify.
 *
 * Uso global en main.ts:
 *   app.useGlobalGuards(new AuthGuard({ mode: 'jwt-verify', jwtKey: process.env.JWT_KEY }))
 *
 * Acceso en handlers:
 *   @Get()
 *   findAll(@Req() req: Request & { authContext: AuthContext }) {
 *     const { ownerId } = req.authContext
 *   }
 */
export class AuthGuard implements CanActivate {
  private opts: Required<AuthMiddlewareOptions>

  constructor(options: AuthMiddlewareOptions = {}) {
    this.opts = {
      mode:                 options.mode                 ?? 'gateway-trust',
      jwtKey:               options.jwtKey               ?? '',
      unauthorizedMessage:  options.unauthorizedMessage  ?? 'Unauthorized',
    }
  }

  canActivate(context: any): boolean {
    const req: Record<string, any> = context.switchToHttp().getRequest()
    const headers: Record<string, string | string[] | undefined> = req.headers ?? {}

    if (this.opts.mode === 'jwt-verify') {
      const authHeader = typeof headers['authorization'] === 'string'
        ? headers['authorization']
        : undefined
      const result = buildAuthContextFromJwt(authHeader, this.opts.jwtKey)
      if (!result.ok) return false
      req.authContext = result.ctx
    } else {
      const ownerId = headers['owner-id']
      if (!ownerId) return false
      req.authContext = buildAuthContextFromHeaders(headers) as AuthContext
    }

    return true
  }
}
