/**
 * Contexto de autenticación disponible en request.authContext.
 *
 * En modo gateway-trust: viene de los headers inyectados por KrakenD.
 * En modo jwt-verify:    viene del payload del JWT verificado.
 * Ambos modos exponen exactamente los mismos campos.
 */
export interface AuthContext {
  ownerId: string
  userId: string
  roleId: string
  employeeId: string
  enterpriseId: string
  fullUserName: string
  ownerName: string
  roleName: string
  // Entitlements del plan del tenant (defensa en profundidad backend). Ver ADR-014.
  planCode: string
  planStatus: string
  modules: string[]
}

/**
 * Interfaz mínima de logger compatible con @smdv/logwise.
 *
 * middleware NO depende de logwise directamente — acepta cualquier
 * objeto que implemente estos tres métodos. La clase Logger de logwise
 * la satisface sin ningún cambio.
 *
 * El campo `service` (nombre del microservicio) lo inyecta logwise
 * automáticamente desde la variable de entorno SERVICE_NAME — no hace
 * falta pasarlo aquí.
 *
 * Uso en cada servicio:
 *   import { logger } from '@smdv/logwise'
 *   export default new ExceptionHandlerV5(isDev, logger)
 */
export interface MsLogger {
  error(message: string, params?: Record<string, unknown>, meta?: Record<string, unknown>): void
  warn(message: string, params?: Record<string, unknown>, meta?: Record<string, unknown>): void
  info(message: string, params?: Record<string, unknown>, meta?: Record<string, unknown>): void
}

/**
 * gateway-trust (default):
 *   Lee los headers inyectados por KrakenD (owner-id, user-id, …).
 *   El JWT ya fue verificado por el gateway antes de llegar al servicio.
 *   Apropiado cuando los microservicios son inaccesibles directamente desde
 *   fuera de la VPC / cluster (security groups, Network Policies en K8s).
 *
 * jwt-verify:
 *   Verifica la firma del JWT con JWT_KEY antes de extraer el payload.
 *   Requiere JWT_KEY en los Secrets Manager de cada servicio.
 *   Recomendado como capa de defensa en profundidad para prevenir
 *   llamadas pod-a-pod que eviten el gateway.
 */
export type AuthMode = 'gateway-trust' | 'jwt-verify'

export interface AuthMiddlewareOptions {
  /**
   * Modo de operación del middleware.
   * Default: 'gateway-trust'
   */
  mode?: AuthMode

  /**
   * Clave secreta para jwt.verify().
   * Requerida solo cuando mode = 'jwt-verify'.
   * Leer desde proceso: process.env.JWT_KEY o Env.get('JWT_KEY').
   */
  jwtKey?: string

  /** Default: 'Unauthorized' */
  unauthorizedMessage?: string
}

/**
 * Códigos HTTP usados por las clases de error y los helpers de respuesta.
 *
 * Definido localmente para que middleware no dependa de logwise.
 * `HttpStatusCode` (mismo enum) sigue exportándose desde @smdv/logwise
 * por retrocompatibilidad — ambos coinciden en valores.
 */
export enum HttpStatus {
  // 2xx Success
  OK = 200,
  CREATED = 201,
  ACCEPTED = 202,
  NO_CONTENT = 204,

  // 3xx Redirection
  MOVED_PERMANENTLY = 301,
  FOUND = 302,
  NOT_MODIFIED = 304,

  // 4xx Client Error
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  METHOD_NOT_ALLOWED = 405,
  CONFLICT = 409,
  UNPROCESSABLE_ENTITY = 422,
  TOO_MANY_REQUESTS = 429,

  // 5xx Server Error
  INTERNAL_SERVER_ERROR = 500,
  NOT_IMPLEMENTED = 501,
  BAD_GATEWAY = 502,
  SERVICE_UNAVAILABLE = 503,
  GATEWAY_TIMEOUT = 504,
}

/**
 * Idiomas soportados por los mensajes estándar.
 */
export enum SupportedLang {
  EN = 'en',
  ES = 'es',
}
