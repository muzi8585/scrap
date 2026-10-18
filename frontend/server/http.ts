import type { NextFunction, Request, RequestHandler, Response } from 'express';
import jwt from 'jsonwebtoken';
import { z, ZodTypeAny } from 'zod';

export class HttpError extends Error {
  status: number;
  errors?: Record<string, string[]>;

  constructor(status: number, message: string, errors?: Record<string, string[]>) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

export const wrap =
  (handler: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    handler(req, res).catch(next);
  };

export function parse<S extends ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  const result = schema.safeParse(data);
  if (result.success) return result.data;

  const errors: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || 'body';
    (errors[key] ||= []).push(issue.message);
  }
  throw new HttpError(422, Object.values(errors)[0][0], errors);
}

const secret = (): string => {
  const value = process.env.JWT_SECRET;
  if (value) return value;
  if (process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET is not set');
  return 'dev-secret-change-me';
};

export const signToken = (userId: number): string => jwt.sign({ sub: String(userId) }, secret(), { expiresIn: '30d' });

export const requireAuth: RequestHandler = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  try {
    jwt.verify(token, secret());
    next();
  } catch {
    res.status(401).json({ message: 'Unauthenticated.' });
  }
};

export const errorHandler = (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof HttpError) {
    res.status(error.status).json({ message: error.message, errors: error.errors });
    return;
  }
  console.error(error);
  res.status(500).json({ message: 'Server error. Check that MongoDB is running and MONGODB_URI is correct.' });
};
