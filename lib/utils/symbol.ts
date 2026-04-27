export const NSE_SYMBOL_REGEX = /^[A-Z0-9&\-.]+$/;

export type SymbolValidationErrorCode = 'VALIDATION_ERROR' | 'INVALID_SYMBOL_FORMAT';

export type SymbolValidationResult =
  | { success: true; symbol: string }
  | { success: false; error: string; errorCode: SymbolValidationErrorCode };

function normalizeSymbolValue(raw: string): string {
  return raw.toUpperCase().trim().replace(/\.NS$/i, '');
}

export function parseRequiredNseSymbol(raw: string | null | undefined): SymbolValidationResult {
  if (!raw || raw.trim().length === 0) {
    return {
      success: false,
      error: 'Symbol parameter is required',
      errorCode: 'VALIDATION_ERROR',
    };
  }

  const normalized = normalizeSymbolValue(raw);
  if (!normalized || !NSE_SYMBOL_REGEX.test(normalized)) {
    return {
      success: false,
      error: 'Symbol format is invalid',
      errorCode: 'INVALID_SYMBOL_FORMAT',
    };
  }

  return {
    success: true,
    symbol: normalized,
  };
}

export function parseOptionalNseSymbol(raw: string | null | undefined):
  | { success: true; symbol: string | null }
  | { success: false; error: string; errorCode: SymbolValidationErrorCode } {
  if (!raw || raw.trim().length === 0) {
    return {
      success: true,
      symbol: null,
    };
  }

  const parsed = parseRequiredNseSymbol(raw);
  if (!parsed.success) {
    return parsed;
  }

  return {
    success: true,
    symbol: parsed.symbol,
  };
}
