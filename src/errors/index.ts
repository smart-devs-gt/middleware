/**
 * Errores tipados, códigos de error y handler framework-agnostic.
 *
 * Migrado desde @smdv/logwise (ver docs/MS-MIDDLEWARE-MIGRATION.md).
 */

export { ERROR_CODES, ERROR_MESSAGE_KEYS, ErrorCode, ErrorMessageKey } from './error-codes'

export {
  ApiError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  UnprocessableEntityError,
  TooManyRequestsError,
  InternalServerError,
  ServiceUnavailableError,
  DatabaseError,
  ExternalServiceError,
  setErrorLanguage,
  getErrorLanguage,
} from './api-errors'

export {
  createErrorHandler,
  handleError,
  asyncHandler,
  notFoundHandler,
  ErrorHandlerOptions,
  ErrorResponse,
  HandledError,
} from './error-handler'
