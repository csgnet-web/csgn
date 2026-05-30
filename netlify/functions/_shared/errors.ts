export class HttpError extends Error {
  status: number
  code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export const badRequest = (message: string, code = 'bad_request') => new HttpError(400, code, message)
export const unauthorized = (message = 'Authentication required') => new HttpError(401, 'unauthorized', message)
export const forbidden = (message = 'Forbidden') => new HttpError(403, 'forbidden', message)
export const notFound = (message = 'Not found') => new HttpError(404, 'not_found', message)
export const conflict = (message: string, code = 'conflict') => new HttpError(409, code, message)
