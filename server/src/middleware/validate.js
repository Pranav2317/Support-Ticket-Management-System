const ApiError = require('../utils/ApiError');

/**
 * Validates req.body / req.query / req.params against zod schemas.
 * Parsed (coerced, stripped) values are exposed on req.valid so controllers
 * never touch raw user input.
 */
const validate = (schemas) => (req, _res, next) => {
  req.valid = req.valid || {};
  const errors = [];
  for (const part of ['params', 'query', 'body']) {
    if (!schemas[part]) continue;
    const result = schemas[part].safeParse(req[part] ?? {});
    if (result.success) {
      req.valid[part] = result.data;
    } else {
      for (const issue of result.error.issues) {
        errors.push({ field: [part, ...issue.path].join('.'), message: issue.message });
      }
    }
  }
  if (errors.length) return next(ApiError.badRequest('Validation failed', errors));
  next();
};

module.exports = validate;
