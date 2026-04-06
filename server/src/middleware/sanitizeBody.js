import mongoSanitize from "express-mongo-sanitize";

const { sanitize, has } = mongoSanitize;

/**
 * Default express-mongo-sanitize middleware assigns to req.query, which throws on Express 5
 * (req.query is getter-only). We sanitize req.body in place — covers JSON and multipart fields.
 * Query params are validated/coerced in route handlers (Zod, Number(), etc.).
 */
export function sanitizeBody(options = {}) {
  const { replaceWith = "_", onSanitize } = options;
  return function sanitizeBodyMiddleware(req, _res, next) {
    if (req.body != null && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
      if (has(req.body)) {
        sanitize(req.body, { replaceWith });
        onSanitize?.({ req, key: "body" });
      }
    }
    next();
  };
}
