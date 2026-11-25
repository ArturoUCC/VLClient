const bloquearExternosPruebas = (_req, res, next) => {
  if (process.env.VLCLIENT_TEST_MODE === '1') {
    return res.status(503).json({
      mensaje: 'Servicio externo deshabilitado en el entorno de pruebas',
    });
  }
  return next();
};

module.exports = { bloquearExternosPruebas };
