export class InvalidParameterError extends Error {}

export class SignError extends Error {}

export class VerifySignError extends Error {}

export class TrezorError extends Error {
  public readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'TrezorError';
  }
}
