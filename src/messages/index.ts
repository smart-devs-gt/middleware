/**
 * Mensajes estándar de respuesta API con soporte de internacionalización.
 *
 * Antes vivía en @smdv/logwise. Migrado a ms-middleware como parte de
 * la separación logs / formato HTTP (ver docs/MS-MIDDLEWARE-MIGRATION.md).
 */

import { SupportedLang } from '../types'
import en from './en.json'
import es from './es.json'

export type MessageKey = keyof typeof es

const messages: Record<SupportedLang, Record<string, string>> = { en, es }

/**
 * Obtiene un mensaje traducido según el idioma.
 * Soporta interpolación de parámetros con sintaxis {param}.
 */
export function getMessage(
  lang: SupportedLang,
  key: MessageKey | string,
  params?: Record<string, unknown>,
): string {
  let template = messages[lang][key as string] || messages[SupportedLang.ES][key as string] || (key as string)

  if (params) {
    Object.keys(params).forEach((param) => {
      const value = params[param]
      template = template.replace(new RegExp(`{${param}}`, 'g'), String(value))
    })
  }

  return template
}

/**
 * Crea un helper de mensajes con idioma predefinido.
 */
export function createMessageHelper(lang: SupportedLang = SupportedLang.ES) {
  return {
    get: (key: MessageKey | string, params?: Record<string, unknown>) => getMessage(lang, key, params),
    lang,
  }
}

/**
 * Mensajes en español (default) — acceso directo sin i18n.
 */
export const Messages = {
  // CRUD
  FIND: es.FIND,
  FIND_NO: es.FIND_NO,
  CREATED_SUCCESS: es.CREATED_SUCCESS,
  UPDATED_SUCCESS: es.UPDATED_SUCCESS,
  DELETED_SUCCESS: es.DELETED_SUCCESS,

  // Validation
  FIELD_REQUIRED: es.FIELD_REQUIRED,
  FIELD_EMPTY: es.FIELD_EMPTY,
  FIELD_TYPE: es.FIELD_TYPE,
  FIELD_MIN_LENGTH: es.FIELD_MIN_LENGTH,
  FIELD_MAX_LENGTH: es.FIELD_MAX_LENGTH,
  FIELD_INVALID_FORMAT: es.FIELD_INVALID_FORMAT,

  // Auth
  AUTH_SUCCESS: es.AUTH_SUCCESS,
  AUTH_FAILED: es.AUTH_FAILED,
  AUTH_TOKEN_EXPIRED: es.AUTH_TOKEN_EXPIRED,
  AUTH_TOKEN_INVALID: es.AUTH_TOKEN_INVALID,
  AUTH_UNAUTHORIZED: es.AUTH_UNAUTHORIZED,
  AUTH_FORBIDDEN: es.AUTH_FORBIDDEN,

  // Server
  SERVER_ERROR: es.SERVER_ERROR,
  SERVICE_UNAVAILABLE: es.SERVICE_UNAVAILABLE,

  // DB
  DB_CONNECTION_ERROR: es.DB_CONNECTION_ERROR,
  DB_QUERY_ERROR: es.DB_QUERY_ERROR,

  // Generic
  SUCCESS: es.SUCCESS,
  ERROR: es.ERROR,
  BAD_REQUEST: es.BAD_REQUEST,
  NOT_FOUND: es.NOT_FOUND,
} as const

export type MessagesType = typeof Messages

/**
 * Versión genérica del helper de traducción (compat con logwise.translate).
 */
export function translate(
  lang: SupportedLang,
  key: string,
  params?: Record<string, unknown>,
): string {
  return getMessage(lang, key, params)
}
