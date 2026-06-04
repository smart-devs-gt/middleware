/**
 * Contrato de respuesta único para todos los microservicios.
 *
 * Forma estándar:
 *   { success: true,  message: string, response: T }       — éxito
 *   { success: false, message: string, errors?: unknown }   — error
 *
 * Nota: el campo se llama `response` (no `data`) para mantener
 * compatibilidad con el contrato ya establecido en los servicios.
 */
export interface ApiResponse<T = null> {
  success: boolean
  message: string
  response?: T
  errors?: unknown
}

// ── Éxito ────────────────────────────────────────────────────────────────────

export function okResponse<T>(data: T, message = 'ok'): ApiResponse<T> {
  return { success: true, message, response: data }
}

export function createdResponse<T>(data: T, message = 'Creado correctamente'): ApiResponse<T> {
  return { success: true, message, response: data }
}

export function updatedResponse<T>(data: T, message = 'Actualizado correctamente'): ApiResponse<T> {
  return { success: true, message, response: data }
}

export function deletedResponse(message = 'Eliminado correctamente'): ApiResponse<null> {
  return { success: true, message, response: null }
}

// ── Error ─────────────────────────────────────────────────────────────────────

export function badRequestResponse(message: string, errors?: unknown): ApiResponse<null> {
  return { success: false, message, errors }
}

export function unauthorizedResponse(message = 'No autorizado'): ApiResponse<null> {
  return { success: false, message }
}

export function forbiddenResponse(message = 'Acceso denegado'): ApiResponse<null> {
  return { success: false, message }
}

export function notFoundResponse(message: string): ApiResponse<null> {
  return { success: false, message }
}

export function unprocessableResponse(message: string, errors?: unknown): ApiResponse<null> {
  return { success: false, message, errors }
}

export function internalErrorResponse(message = 'Error interno del servidor'): ApiResponse<null> {
  return { success: false, message }
}
