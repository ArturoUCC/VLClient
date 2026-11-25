const { performance } = require('node:perf_hooks');

const medirSolicitud = (req, res, next) => {
  if (process.env.PERF_DIAGNOSTICS !== '1') return next();
  const inicio = performance.now();
  res.once('finish', () => {
    const ruta = req.route?.path || 'sin_ruta';
    console.info('Rendimiento HTTP', {
      metodo: req.method, ruta, estado: res.statusCode,
      milisegundos: Math.round(performance.now() - inicio),
    });
  });
  next();
};

module.exports = { medirSolicitud };
