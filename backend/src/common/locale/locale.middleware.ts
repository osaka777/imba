import { Injectable, NestMiddleware } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";

import { runWithLocale } from "./locale.context";
import { parseRequestLocale } from "./parse-request-locale";

@Injectable()
export class LocaleMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    const locale = parseRequestLocale(req.headers["x-locale"], req.headers["accept-language"]);
    runWithLocale(locale, () => next());
  }
}
