const logger = (req, res, next) => {
  const start = Date.now();
  // URLs may contain bearer secrets in either query strings or path segments.
  // Log the method/status only; never interpolate a request URL or body.
  console.log(`[${new Date().toISOString()}] ${req.method}`);
  res.on('finish', () => {
    console.log(`[${new Date().toISOString()}] ${req.method} - ${res.statusCode} - ${Date.now() - start}ms`);
  });
  next();
};

module.exports = logger;
