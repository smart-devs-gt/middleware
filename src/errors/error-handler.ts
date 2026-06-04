/**
 * Error handler framework-agnostic + middleware Express opcional.
 *
 * Antes vivía en @smdv/logwise. Migrado a middleware como parte de
 * la separación logs / formato HTTP (ver docs/MIDDLEWARE-MIGRATION.md).
 *
 * - `handleError(error, logger, service?)`: clasifica un error y devuelve
 *   `{ status, body }` sin acoplarse a ningún framework. Úsalo en
 *   `Catch.ts`/`ErrorCatch.ts` de cualquier servicio.
 * - `createErrorHandler()`, `asyncHandler()`, `notFoundHandler()`: helpers
 *   Express. Importan tipos de `express` solo de forma type-only para que
 *   el paquete pueda compilar y ejecutarse en servicios que no usan Express.
 */

import type { Request, Response, NextFunction } from 'express'
import { HttpStatus, SupportedLang, MsLogger } from '../types'
import { getMessage } from '../messages'
import { ApiError } from './api-errors'

/** Logger de fallback que escribe JSON a stdout/stderr (para servicios sin logger inyectado). */
const fallbackLogger: MsLogger = {
  error: (msg, _p, meta) => console.error(JSON.stringify({ level: 'error', message: msg, ...meta })),
  warn: (msg, _p, meta) => console.warn(JSON.stringify({ level: 'warn', message: msg, ...meta })),
  info: (msg, _p, meta) => console.log(JSON.stringify({ level: 'info', message: msg, ...meta })),
}

export interface ErrorHandlerOptions {
  logger?: MsLogger
  lang?: SupportedLang
  includeStackInDev?: boolean
  devEnvironment?: string
  onError?: (error: Error, req: Request) => void
}

export interface ErrorResponse {
  success: false
  message: string
  errors: any
  code?: string
  stack?: string
}

function getStandardMessage(statusCode: HttpStatus, lang: SupportedLang): string {
  const messageMap: Record<number, string> = {
    [HttpStatus.BAD_REQUEST]: getMessage(lang, 'BAD_REQUEST'),
    [HttpStatus.UNAUTHORIZED]: getMessage(lang, 'AUTH_UNAUTHORIZED'),
    [HttpStatus.FORBIDDEN]: getMessage(lang, 'AUTH_FORBIDDEN'),
    [HttpStatus.NOT_FOUND]: getMessage(lang, 'NOT_FOUND'),
    [HttpStatus.CONFLICT]: getMessage(lang, 'CONFLICT'),
    [HttpStatus.UNPROCESSABLE_ENTITY]: getMessage(lang, 'UNPROCESSABLE_ENTITY'),
    [HttpStatus.TOO_MANY_REQUESTS]: getMessage(lang, 'RATE_LIMIT_EXCEEDED'),
    [HttpStatus.INTERNAL_SERVER_ERROR]: getMessage(lang, 'SERVER_ERROR'),
    [HttpStatus.BAD_GATEWAY]: getMessage(lang, 'SERVICE_UNAVAILABLE'),
    [HttpStatus.SERVICE_UNAVAILABLE]: getMessage(lang, 'SERVICE_UNAVAILABLE'),
    [HttpStatus.GATEWAY_TIMEOUT]: getMessage(lang, 'TIMEOUT_ERROR'),
  }

  return messageMap[statusCode] || getMessage(lang, 'ERROR')
}

function getStatusCode(error: Error): HttpStatus {
  if (error instanceof ApiError) {
    return error.statusCode
  }

  // Mongo
  if (error.name === 'MongoError' || error.name === 'MongoServerError') {
    if ((error as any).code === 11000) {
      return HttpStatus.CONFLICT
    }
    return HttpStatus.INTERNAL_SERVER_ERROR
  }

  // Mongoose ValidationError
  if (error.name === 'ValidationError') {
    return HttpStatus.BAD_REQUEST
  }

  // Mongoose CastError (ID inválido)
  if (error.name === 'CastError') {
    return HttpStatus.BAD_REQUEST
  }

  // JWT
  if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
    return HttpStatus.UNAUTHORIZED
  }

  return HttpStatus.INTERNAL_SERVER_ERROR
}

function extractValidationErrors(error: Error): any {
  if (error instanceof ApiError && error.errors) {
    return error.errors
  }

  if (error.name === 'ValidationError' && (error as any).errors) {
    const mongooseErrors: Record<string, string[]> = {}
    for (const [field, err] of Object.entries((error as any).errors)) {
      mongooseErrors[field] = [(err as any).message]
    }
    return Object.keys(mongooseErrors).length > 0 ? mongooseErrors : null
  }

  if ((error as any).code === 11000 && (error as any).keyValue) {
    return { duplicateKey: Object.keys((error as any).keyValue) }
  }

  return null
}

/**
 * Resultado estandarizado de handleError — framework agnostic.
 */
export interface HandledError {
  status: number
  body: ErrorResponse
}

/**
 * Clasifica un error y devuelve `{ status, body }` sin acoplarse a ningún framework.
 *
 * @example
 * // En Catch.ts de AdonisJS:
 * const { status, body } = handleError(error, logger, 'ms-core-customer')
 * return response.status(status).json(body)
 */
export function handleError(
  error: any,
  logger: MsLogger = fallbackLogger,
  service?: string,
  lang: SupportedLang = SupportedLang.ES,
): HandledError {
  const status = getStatusCode(error)

  const logMeta = {
    service,
    errorName: error?.name,
    errorCode: error instanceof ApiError ? error.code : undefined,
    stack: error?.stack?.split('\n').slice(0, 4).join(' | '),
    sqlMessage: (error as any)?.sqlMessage,
  }

  if (status >= 500) {
    logger.error(`[${status}] ${error?.message ?? 'Error desconocido'}`, undefined, logMeta)
  } else {
    logger.warn(`[${status}] ${error?.message ?? 'Error desconocido'}`, undefined, logMeta)
  }

  // MySQL (Adonis Lucid / Knex)
  const sqlCode = (error as any)?.code
  if (sqlCode === 'ER_DUP_ENTRY') {
    return {
      status: 409,
      body: { success: false, message: getMessage(lang, 'CONFLICT'), errors: null, code: 'DUPLICATE_KEY' },
    }
  }
  if (sqlCode === 'ER_NO_REFERENCED_ROW' || sqlCode === 'ER_NO_REFERENCED_ROW_2') {
    return {
      status: 422,
      body: { success: false, message: getMessage(lang, 'UNPROCESSABLE_ENTITY'), errors: null, code: 'UNPROCESSABLE_ENTITY' },
    }
  }
  if (sqlCode && typeof sqlCode === 'string' && sqlCode.startsWith('ER_')) {
    return {
      status: 500,
      body: { success: false, message: getMessage(lang, 'SERVER_ERROR'), errors: null, code: 'DATABASE_ERROR' },
    }
  }

  // Adonis ValidationException
  if (
    error?.code === 'E_VALIDATION_FAILURE' ||
    error?.constructor?.name === 'ValidationException' ||
    error?.name === 'ValidationException'
  ) {
    return {
      status: 422,
      body: {
        success: false,
        message: 'Los datos enviados no son válidos',
        errors: error?.messages ?? null,
        code: 'VALIDATION_ERROR',
      },
    }
  }

  // Adonis ModelNotFoundException
  if (error?.code === 'E_ROW_NOT_FOUND' || error?.constructor?.name === 'ModelNotFoundException') {
    return {
      status: 404,
      body: { success: false, message: getMessage(lang, 'NOT_FOUND'), errors: null, code: 'NOT_FOUND' },
    }
  }

  if (error instanceof ApiError) {
    return {
      status,
      body: {
        success: false,
        message: error.isOperational ? error.message : getMessage(lang, 'SERVER_ERROR'),
        errors: extractValidationErrors(error),
        code: error.code,
      },
    }
  }

  return {
    status: status >= 400 ? status : 500,
    body: { success: false, message: getMessage(lang, 'SERVER_ERROR'), errors: null, code: 'INTERNAL_SERVER_ERROR' },
  }
}

/**
 * Middleware Express para manejo de errores.
 */
export function createErrorHandler(options: ErrorHandlerOptions = {}) {
  const {
    logger = fallbackLogger,
    lang = SupportedLang.ES,
    includeStackInDev = true,
    devEnvironment = 'development',
    onError,
  } = options

  const isDevelopment = process.env.NODE_ENV === devEnvironment

  return (
    error: Error,
    req: Request,
    res: Response,
    _next: NextFunction,
  ): Response => {
    const logContext = {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      errorName: error.name,
      errorCode: error instanceof ApiError ? error.code : undefined,
      stack: error.stack,
    }

    const statusCode = getStatusCode(error)
    if (statusCode >= 500) {
      logger.error(`[${statusCode}] ${error.message}`, undefined, logContext)
    } else {
      logger.warn(`[${statusCode}] ${error.message}`, undefined, logContext)
    }

    if (onError) {
      try {
        onError(error, req)
      } catch (callbackError) {
        logger.error('Error en callback onError', undefined, { error: callbackError })
      }
    }

    const isOperational = error instanceof ApiError ? error.isOperational : false
    const userMessage = isOperational ? error.message : getStandardMessage(statusCode, lang)

    const response: ErrorResponse = {
      success: false,
      message: userMessage,
      errors: extractValidationErrors(error),
      code: error instanceof ApiError ? error.code : undefined,
    }

    if (isDevelopment && includeStackInDev) {
      response.stack = error.stack
    }

    return res.status(statusCode).json(response)
  }
}

/**
 * Wrapper Express para async handlers (evita try/catch en cada controller).
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

/**
 * Middleware Express para rutas no encontradas.
 */
export function notFoundHandler(options: { lang?: SupportedLang } = {}) {
  const { lang = SupportedLang.ES } = options

  return (req: Request, _res: Response, next: NextFunction) => {
    const error = new ApiError(
      getMessage(lang, 'NOT_FOUND'),
      HttpStatus.NOT_FOUND,
      { path: req.originalUrl },
      'ROUTE_NOT_FOUND',
    )
    next(error)
  }
}
