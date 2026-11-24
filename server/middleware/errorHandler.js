export function notFoundHandler(_req, res) {
  res.status(404).json({ error: 'API route not found.' });
}

export function errorHandler(error, _req, res, _next) {
  console.error(error);
  if (error.code === 'P2003') return res.status(400).json({ error: 'A related record was not found.' });
  if (error.code === 'P2002') return res.status(409).json({ error: 'That record already exists.' });
  res.status(500).json({ error: 'The server could not complete the request.' });
}
