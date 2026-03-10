import { Request, Response, NextFunction, RequestHandler } from 'express';

type AsyncFn = (req: Request, res: Response, next: NextFunction) => Promise<void>;

/** Wraps async route handlers to forward errors to Express error middleware. */
export function asyncHandler(fn: AsyncFn): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
