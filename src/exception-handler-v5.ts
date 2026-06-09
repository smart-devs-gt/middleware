import { MsLogger } from './types'
import {
  internalErrorResponse,
  badRequestResponse,
  notFoundResponse,
  unauthorizedResponse,
} from './response'
import { ApiError } from './errors'

const fallback: MsLogger = {
  error: (msg, _p, meta) => console.error(JSON.stringify({ level: 'error', message: msg, ...meta })),
  warn:  (msg, _p, meta) => console.warn(JSON.stringify({ level: 'warn',  message: msg, ...meta })),
  info:  (msg, _p, meta) => console.log(JSON.stringify({ level: 'info',   message: msg, ...meta })),
}

/**
 * Exception handler para AdonisJS v5.
 *
 * Reemplaza app/Exceptions/Handler.ts en cada servicio:
 *
 *   import { logger } from '@smdv/logwise'
 *   import { ExceptionHandlerV5 } from '@smdv/middleware'
 *
 *   export default class ExceptionHandler extends ExceptionHandlerV5 {
 *     constructor() {
 *       super(process.env.NODE_ENV !== 'production', logger)
 *     }
 *   }
 *
 * El `logger` de logwise incluye automáticamente el campo `service`
 * (desde SERVICE_NAME env) en cada entrada → CloudWatch puede filtrar
 * por servicio sin configuración adicional.
 *
 * Si no se pasa logger, usa console con formato JSON mínimo como fallback.
 */
export class ExceptionHandlerV5 {
  private log: MsLogger

  constructor(
    protected debug = false,
    logger?: MsLogger,
  ) {
    this.log = logger ?? fallback
  }

  // AdonisJS v5 calls report() before handle(). Logging is done in handle(),
  // so this is intentionally a no-op to avoid the "Missing method report" FATAL.
  public report(_error: any, _ctx: any): void {}

  public async handle(error: any, ctx: any) {
    const { response, request } = ctx
    const status: number = error instanceof ApiError
      ? error.statusCode
      : (error.status ?? error.statusCode ?? 500)
    const meta = {
      status,
      code: error instanceof ApiError ? error.code : error.code,
      method: request?.method?.(),
      url: request?.url?.(),
      ...(this.debug && error.stack ? { stack: error.stack } : {}),
    }

    // 5xx → error, 4xx → warn (errores de cliente son esperados)
    if (status >= 500) {
      this.log.error(error.message ?? 'Unhandled exception', undefined, {
        ...meta,
        ...(error.stack ? { stack: error.stack } : {}),
      })
    } else {
      this.log.warn(error.message ?? 'Client error', undefined, meta)
    }

    // ApiError tipado (NotFoundError, ValidationError, ForbiddenError, …)
    if (error instanceof ApiError) {
      const body = {
        success: false as const,
        message: error.isOperational
          ? error.message
          : (this.debug ? error.message : 'Error interno del servidor'),
        errors: error.errors ?? undefined,
      }
      return response.status(error.statusCode).json(body)
    }

    if (error.code === 'E_VALIDATION_FAILURE') {
      return response.unprocessableEntity(
        badRequestResponse('Error de validación', error.messages)
      )
    }

    if (error.code === 'E_ROW_NOT_FOUND') {
      return response.notFound(notFoundResponse('Recurso no encontrado'))
    }

    if (error.code === 'E_ROUTE_NOT_FOUND') {
      return response.notFound(notFoundResponse('Recurso no encontrado'))
    }

    if (error.code === 'E_METHOD_NOT_ALLOWED') {
      return response.status(405).json(
        badRequestResponse('Método no permitido para este recurso')
      )
    }

    if (error.code === 'E_UNAUTHORIZED_ACCESS' || status === 401) {
      return response.unauthorized(unauthorizedResponse())
    }

    if (status >= 400 && status < 500) {
      const clientMessage = this.debug
        ? (error.message ?? 'Solicitud inválida')
        : 'Solicitud inválida'
      return response.status(status).json(
        badRequestResponse(clientMessage, error.errors)
      )
    }

    return response.internalServerError(
      internalErrorResponse('Error interno del servidor')
    )
  }
}
