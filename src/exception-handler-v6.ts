import { MsLogger } from './types'
import {
  internalErrorResponse,
  badRequestResponse,
  notFoundResponse,
  unauthorizedResponse,
} from './response'
import { ApiError } from './errors'

type HttpContext = {
  request?: {
    method?(): string
    url?(): string
  }
  response: {
    status(code: number): { json(body: unknown): void }
    unprocessableEntity(body: unknown): void
    notFound(body: unknown): void
    unauthorized(body: unknown): void
    internalServerError(body: unknown): void
  }
}

const fallback: MsLogger = {
  error: (msg, _p, meta) => console.error(JSON.stringify({ level: 'error', message: msg, ...meta })),
  warn:  (msg, _p, meta) => console.warn(JSON.stringify({ level: 'warn',  message: msg, ...meta })),
  info:  (msg, _p, meta) => console.log(JSON.stringify({ level: 'info',   message: msg, ...meta })),
}

/**
 * Exception handler para AdonisJS v6.
 *
 * Reemplaza app/exceptions/handler.ts en cada servicio:
 *
 *   import { logger } from '@smdv/logwise'
 *   import { ExceptionHandlerV6 } from '@smdv/middleware'
 *   import app from '@adonisjs/core/services/app'
 *
 *   export default new ExceptionHandlerV6(!app.inProduction, logger)
 *
 * Ver ExceptionHandlerV5 para documentación completa.
 */
export class ExceptionHandlerV6 {
  private log: MsLogger

  constructor(
    protected debug = false,
    logger?: MsLogger,
  ) {
    this.log = logger ?? fallback
  }

  async handle(error: any, ctx: HttpContext) {
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
      internalErrorResponse(
        this.debug ? (error.message ?? 'Error interno') : 'Error interno del servidor'
      )
    )
  }

  async report(_error: unknown, _ctx: HttpContext) {
    // Telemetría futura
  }
}
