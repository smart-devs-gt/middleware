/**
 * Clases de error tipadas para APIs.
 *
 * Antes vivía en @smdv/logwise. Migrado a ms-middleware como parte de
 * la separación logs / formato HTTP (ver docs/MS-MIDDLEWARE-MIGRATION.md).
 */

import { HttpStatus, SupportedLang } from '../types'
import { getMessage } from '../messages'
import { ERROR_CODES, ERROR_MESSAGE_KEYS, ErrorCode } from './error-codes'

let defaultLang: SupportedLang = SupportedLang.ES

export function setErrorLanguage(lang: SupportedLang): void {
  defaultLang = lang
}

export function getErrorLanguage(): SupportedLang {
  return defaultLang
}

/**
 * Error base para APIs.
 */
export class ApiError extends Error {
  public readonly statusCode: HttpStatus
  public readonly isOperational: boolean
  public readonly errors: any
  public readonly code: ErrorCode

  constructor(
    message: string,
    statusCode: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR,
    errors: any = null,
    code: ErrorCode = ERROR_CODES.INTERNAL_SERVER_ERROR,
    isOperational: boolean = true,
  ) {
    super(message)
    this.name = this.constructor.name
    this.statusCode = statusCode
    this.isOperational = isOperational
    this.errors = errors
    this.code = code

    Error.captureStackTrace(this, this.constructor)
  }
}

export class ValidationError extends ApiError {
  constructor(message?: string, errors: any = null) {
    const msg = message || getMessage(defaultLang, ERROR_MESSAGE_KEYS.VALIDATION_ERROR)
    super(msg, HttpStatus.BAD_REQUEST, errors, ERROR_CODES.VALIDATION_ERROR)
    this.name = 'ValidationError'
  }
}

export class NotFoundError extends ApiError {
  constructor(message?: string, resource?: string) {
    const msg = message || getMessage(defaultLang, ERROR_MESSAGE_KEYS.NOT_FOUND)
    super(
      msg,
      HttpStatus.NOT_FOUND,
      resource ? { resource } : null,
      ERROR_CODES.NOT_FOUND,
    )
    this.name = 'NotFoundError'
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message?: string) {
    const msg = message || getMessage(defaultLang, ERROR_MESSAGE_KEYS.UNAUTHORIZED)
    super(msg, HttpStatus.UNAUTHORIZED, null, ERROR_CODES.UNAUTHORIZED)
    this.name = 'UnauthorizedError'
  }
}

export class ForbiddenError extends ApiError {
  constructor(message?: string) {
    const msg = message || getMessage(defaultLang, ERROR_MESSAGE_KEYS.FORBIDDEN)
    super(msg, HttpStatus.FORBIDDEN, null, ERROR_CODES.FORBIDDEN)
    this.name = 'ForbiddenError'
  }
}

export class ConflictError extends ApiError {
  constructor(message?: string, errors: any = null) {
    const msg = message || getMessage(defaultLang, ERROR_MESSAGE_KEYS.CONFLICT)
    super(msg, HttpStatus.CONFLICT, errors, ERROR_CODES.CONFLICT)
    this.name = 'ConflictError'
  }
}

export class UnprocessableEntityError extends ApiError {
  constructor(message?: string, errors: any = null) {
    const msg = message || getMessage(defaultLang, ERROR_MESSAGE_KEYS.UNPROCESSABLE)
    super(msg, HttpStatus.UNPROCESSABLE_ENTITY, errors, ERROR_CODES.UNPROCESSABLE_ENTITY)
    this.name = 'UnprocessableEntityError'
  }
}

export class TooManyRequestsError extends ApiError {
  constructor(message?: string, retryAfter?: number) {
    const msg = message || getMessage(defaultLang, ERROR_MESSAGE_KEYS.RATE_LIMIT)
    super(
      msg,
      HttpStatus.TOO_MANY_REQUESTS,
      retryAfter ? { retryAfter } : null,
      ERROR_CODES.TOO_MANY_REQUESTS,
    )
    this.name = 'TooManyRequestsError'
  }
}

export class InternalServerError extends ApiError {
  constructor(message?: string) {
    const msg = message || getMessage(defaultLang, ERROR_MESSAGE_KEYS.SERVER_ERROR)
    super(msg, HttpStatus.INTERNAL_SERVER_ERROR, null, ERROR_CODES.INTERNAL_SERVER_ERROR, false)
    this.name = 'InternalServerError'
  }
}

export class ServiceUnavailableError extends ApiError {
  constructor(message?: string) {
    const msg = message || getMessage(defaultLang, ERROR_MESSAGE_KEYS.SERVICE_UNAVAILABLE)
    super(msg, HttpStatus.SERVICE_UNAVAILABLE, null, ERROR_CODES.SERVICE_UNAVAILABLE, false)
    this.name = 'ServiceUnavailableError'
  }
}

export class DatabaseError extends ApiError {
  constructor(message?: string) {
    const msg = message || getMessage(defaultLang, ERROR_MESSAGE_KEYS.DB_ERROR)
    super(msg, HttpStatus.INTERNAL_SERVER_ERROR, null, ERROR_CODES.DATABASE_ERROR, false)
    this.name = 'DatabaseError'
  }
}

export class ExternalServiceError extends ApiError {
  constructor(message?: string, service?: string) {
    const msg = message || getMessage(defaultLang, ERROR_MESSAGE_KEYS.EXT_SERVICE_ERROR)
    super(
      msg,
      HttpStatus.BAD_GATEWAY,
      service ? { service } : null,
      ERROR_CODES.EXTERNAL_SERVICE_ERROR,
      false,
    )
    this.name = 'ExternalServiceError'
  }
}
