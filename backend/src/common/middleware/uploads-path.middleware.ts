import { NextFunction, Request, Response } from 'express';

const ALLOWED_UPLOAD_PREFIXES = [
  '/uploads/receipts/',
  '/uploads/banners/',
  '/uploads/slides/',
  '/uploads/footer-badges/',
  '/uploads/qr/',
  '/uploads/avatars/',
  '/uploads/prediction/',
];

export function uploadsPathGuard(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const url = req.url.split('?')[0] ?? '';

  if (!url.startsWith('/uploads')) {
    next();
    return;
  }

  if (url.includes('..') || url.includes('\\')) {
    res.status(400).send('Bad Request');
    return;
  }

  const allowed = ALLOWED_UPLOAD_PREFIXES.some((prefix) => url.startsWith(prefix));
  if (!allowed) {
    res.status(404).send('Not Found');
    return;
  }

  next();
}
