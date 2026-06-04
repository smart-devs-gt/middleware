import { verify, JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken'
import { AuthContext } from './types'

export type RawHeaders = Record<string, string | string[] | undefined>

function str(headers: RawHeaders, key: string): string {
  const val = headers[key]
  if (Array.isArray(val)) return val[0] ?? ''
  return val ?? ''
}

/**
 * Modo gateway-trust: construye AuthContext desde los headers inyectados por KrakenD.
 *
 * El gateway llama a ms-core-auth /auth/verify-session antes de rutear,
 * así que cuando este código se ejecuta el JWT ya fue validado.
 */
export function buildAuthContextFromHeaders(headers: RawHeaders): AuthContext {
  return {
    ownerId:      str(headers, 'owner-id'),
    userId:       str(headers, 'user-id'),
    roleId:       str(headers, 'role-id'),
    employeeId:   str(headers, 'employee-id'),
    enterpriseId: str(headers, 'enterprise-id'),
    fullUserName: str(headers, 'full-user-name'),
    ownerName:    str(headers, 'owner-name'),
    roleName:     str(headers, 'role-name'),
  }
}

export type JwtVerifyResult =
  | { ok: true; ctx: AuthContext }
  | { ok: false; reason: 'missing' | 'expired' | 'invalid' }

/**
 * Modo jwt-verify: verifica la firma del JWT con jwt.verify() y extrae
 * el AuthContext directamente del payload.
 *
 * Ventaja sobre jwtDecode(): un token forjado o expirado es rechazado aquí,
 * incluso si el request llegó sin pasar por el gateway (llamada pod-a-pod).
 *
 * El payload del token de ms-core-auth contiene los mismos campos que los
 * headers inyectados por KrakenD — la fuente de verdad es la misma.
 */
export function buildAuthContextFromJwt(authHeader: string | undefined, jwtKey: string): JwtVerifyResult {
  if (!authHeader?.toLowerCase().startsWith('bearer ')) {
    return { ok: false, reason: 'missing' }
  }

  const token = authHeader.slice(7) // quita "Bearer "

  try {
    const payload = verify(token, jwtKey) as Record<string, string>
    return {
      ok: true,
      ctx: {
        ownerId:      payload['ownerId']       ?? '',
        userId:       payload['userId']        ?? '',
        roleId:       payload['roleId']        ?? '',
        employeeId:   payload['employeeId']    ?? '',
        enterpriseId: payload['enterpriseId']  ?? '',
        fullUserName: payload['fullUserName']  ?? '',
        ownerName:    payload['ownerName']     ?? '',
        roleName:     payload['roleName']      ?? '',
      },
    }
  } catch (err) {
    if (err instanceof TokenExpiredError) return { ok: false, reason: 'expired' }
    if (err instanceof JsonWebTokenError)  return { ok: false, reason: 'invalid' }
    return { ok: false, reason: 'invalid' }
  }
}
