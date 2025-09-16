import type { Request, Response, NextFunction } from "express";
import { supportedLanguages, defaultLanguage } from "../config/i18n";
import { createRequestLogger } from "../config/logger";

/**
 * Middleware to detect and set the language for the request
 */
export const languageMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const requestLogger = createRequestLogger(req.id);

  // Get language from query parameter, header, or cookie
  let language =
    (req.query.lang as string) ||
    req.headers["accept-language"] ||
    req.cookies?.lang ||
    defaultLanguage;

  // If accept-language header contains multiple languages, get the first one
  if (typeof language === "string" && language.includes(",")) {
    language = language.split(",")[0].trim();
  }

  // If language contains a region code (e.g., en-US), get just the language part
  if (typeof language === "string" && language.includes("-")) {
    language = language.split("-")[0].toLowerCase();
  }

  // Check if the language is supported
  if (!supportedLanguages.includes(language)) {
    requestLogger.debug(`Unsupported language: ${language}, using default: ${defaultLanguage}`);
    language = defaultLanguage;
  }

  // Set language for the request
  req.language = language;

  // Set language cookie for future requests
  res.cookie("lang", language, {
    maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });

  requestLogger.debug(`Language set to: ${language}`);
  next();
};

// Extend Express Request interface to include language
declare global {
  namespace Express {
    interface Request {
      language: string;
    }
  }
}
