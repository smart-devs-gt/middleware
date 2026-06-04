// Auth context + logger interface
export { AuthContext, AuthMode, AuthMiddlewareOptions, MsLogger, HttpStatus, SupportedLang } from './types'
export { buildAuthContextFromHeaders, buildAuthContextFromJwt } from './context'

// Auth middlewares
export { default as AuthorizationMiddleware }   from './adonis-v5'
export { default as AuthorizationMiddlewareV6 } from './adonis-v6'
export { AuthGuard }                            from './nestjs'

// Response helpers
export {
  ApiResponse,
  okResponse,
  createdResponse,
  updatedResponse,
  deletedResponse,
  badRequestResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
  unprocessableResponse,
  internalErrorResponse,
} from './response'

// Exception handlers
export { ExceptionHandlerV5 } from './exception-handler-v5'
export { ExceptionHandlerV6 } from './exception-handler-v6'

// Errors (migrado desde @smdv/logwise)
export {
  ERROR_CODES,
  ERROR_MESSAGE_KEYS,
  ErrorCode,
  ErrorMessageKey,
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
  createErrorHandler,
  handleError,
  asyncHandler,
  notFoundHandler,
  ErrorHandlerOptions,
  ErrorResponse,
  HandledError,
} from './errors'

// Mensajes estándar (migrado desde @smdv/logwise)
export {
  Messages,
  MessagesType,
  MessageKey,
  getMessage,
  createMessageHelper,
  translate,
} from './messages'

// HTTP constants & helpers (migrado desde @smdv/logwise)
export {
  HTTP_OK,
  HTTP_CREATED,
  HTTP_ACCEPTED,
  HTTP_NO_CONTENT,
  HTTP_MOVED_PERMANENTLY,
  HTTP_FOUND,
  HTTP_NOT_MODIFIED,
  HTTP_BAD_REQUEST,
  HTTP_UNAUTHORIZED,
  HTTP_FORBIDDEN,
  HTTP_NOT_FOUND,
  HTTP_METHOD_NOT_ALLOWED,
  HTTP_CONFLICT,
  HTTP_UNPROCESSABLE,
  HTTP_UNPROCESSABLE_ENTITY,
  HTTP_TOO_MANY_REQUESTS,
  HTTP_INTERNAL_ERROR,
  HTTP_INTERNAL_SERVER_ERROR,
  HTTP_NOT_IMPLEMENTED,
  HTTP_BAD_GATEWAY,
  HTTP_SERVICE_UNAVAILABLE,
  HTTP_GATEWAY_TIMEOUT,
  isSuccessCode,
  isClientError,
  isServerError,
  isErrorCode,
} from './http'
