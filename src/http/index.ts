/**
 * Constantes y helpers HTTP.
 *
 * Antes vivía en @smdv/logwise. Migrado a middleware como parte de
 * la separación logs / formato HTTP (ver docs/MIDDLEWARE-MIGRATION.md).
 */

import { HttpStatus } from '../types'

// 2xx Success
export const HTTP_OK = HttpStatus.OK
export const HTTP_CREATED = HttpStatus.CREATED
export const HTTP_ACCEPTED = HttpStatus.ACCEPTED
export const HTTP_NO_CONTENT = HttpStatus.NO_CONTENT

// 3xx Redirection
export const HTTP_MOVED_PERMANENTLY = HttpStatus.MOVED_PERMANENTLY
export const HTTP_FOUND = HttpStatus.FOUND
export const HTTP_NOT_MODIFIED = HttpStatus.NOT_MODIFIED

// 4xx Client Error
export const HTTP_BAD_REQUEST = HttpStatus.BAD_REQUEST
export const HTTP_UNAUTHORIZED = HttpStatus.UNAUTHORIZED
export const HTTP_FORBIDDEN = HttpStatus.FORBIDDEN
export const HTTP_NOT_FOUND = HttpStatus.NOT_FOUND
export const HTTP_METHOD_NOT_ALLOWED = HttpStatus.METHOD_NOT_ALLOWED
export const HTTP_CONFLICT = HttpStatus.CONFLICT
export const HTTP_UNPROCESSABLE = HttpStatus.UNPROCESSABLE_ENTITY
export const HTTP_UNPROCESSABLE_ENTITY = HttpStatus.UNPROCESSABLE_ENTITY
export const HTTP_TOO_MANY_REQUESTS = HttpStatus.TOO_MANY_REQUESTS

// 5xx Server Error
export const HTTP_INTERNAL_ERROR = HttpStatus.INTERNAL_SERVER_ERROR
export const HTTP_INTERNAL_SERVER_ERROR = HttpStatus.INTERNAL_SERVER_ERROR
export const HTTP_NOT_IMPLEMENTED = HttpStatus.NOT_IMPLEMENTED
export const HTTP_BAD_GATEWAY = HttpStatus.BAD_GATEWAY
export const HTTP_SERVICE_UNAVAILABLE = HttpStatus.SERVICE_UNAVAILABLE
export const HTTP_GATEWAY_TIMEOUT = HttpStatus.GATEWAY_TIMEOUT

export const isSuccessCode = (code: number): boolean => code >= 200 && code < 300
export const isClientError = (code: number): boolean => code >= 400 && code < 500
export const isServerError = (code: number): boolean => code >= 500 && code < 600
export const isErrorCode = (code: number): boolean => code >= 400
