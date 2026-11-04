const http = require('node:http');

async function listen(app) {
  const server = http.createServer(app);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return {
    async post(body, headers = {}) {
      const data = JSON.stringify(body);
      return new Promise((resolve, reject) => {
        const req = http.request({
          hostname: '127.0.0.1', port: server.address().port,
          path: '/api/v1/auth/forgot-password', method: 'POST',
          headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data), ...headers },
        }, res => {
          let text = '';
          res.setEncoding('utf8');
          res.on('data', part => { text += part; });
          res.on('end', () => {
            try { resolve({ status: res.statusCode, body: JSON.parse(text) }); }
            catch (error) { reject(error); }
          });
        });
        req.on('error', reject);
        req.end(data);
      });
    },
    close() { return new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); },
  };
}

module.exports = { listen };
