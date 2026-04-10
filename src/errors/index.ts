export class NotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "NotFoundError"
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ConflictError"
  }
}

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ForbiddenError"
  }
}

export class AIUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AIUnavailableError"
  }
}

export class S3Error extends Error {
  constructor(message: string) {
    super(message)
    this.name = "S3Error"
  }
}

export class DBError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "DBError"
  }
}
