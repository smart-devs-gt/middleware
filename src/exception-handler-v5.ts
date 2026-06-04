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

  public async handle(error: any, { response }: any) {
    const status: number = error instanceof ApiError
      ? error.statusCode
      : (error.status ?? error.statusCode ?? 500)
    const meta = {
      status,
      code: error instanceof ApiError ? error.code : error.code,
      ...(this.debug && error.stack ? { stack: error.stack } : {}),
    }

    // 5xx → error, 4xx → warn (errores de cliente son esperados)
    if (status >= 500) {
      this.log.error(error.message ?? 'Unhandled exception', undefined, meta)
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

    if (error.code === 'E_UNAUTHORIZED_ACCESS' || status === 401) {
      return response.unauthorized(unauthorizedResponse())
    }

    if (status >= 400 && status < 500) {
      return response.status(status).json(
        badRequestResponse(error.message ?? 'Solicitud inválida', error.errors)
      )
    }

    return response.internalServerError(
      internalErrorResponse(
        this.debug ? (error.message ?? 'Error interno') : 'Error interno del servidor'
      )
    )
  }
}
