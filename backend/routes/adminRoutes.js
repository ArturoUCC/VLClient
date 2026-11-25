const express = require('express');
const { verificarAdministrador } = require('../middleware/adminAuthMiddleware');
const { perfilAdministrador,
  logoutAdministrador } = require('../controllers/adminAuthController');
const { iniciarSesionUnificada } = require('../controllers/loginUnificadoController');
const router = express.Router();
const { consultarDisponibilidad, cambiarFecha,
  cambiarHorario } = require('../controllers/disponibilidadController');
const { listarCitas, ejecutarAccion } = require('../controllers/adminCitasController');
const { resumen } = require('../controllers/adminDashboardController');
const { listarInquilinos, detalleInquilino, registrarInquilino } =
  require('../controllers/adminInquilinosController');
const { crearAdministrador, cambiarEstadoAdministrador } =
  require('../controllers/adminCuentasController');
const { buscarPropiedades } = require('../controllers/adminPropiedadesController');

router.post('/auth/login', iniciarSesionUnificada);
router.get('/auth/perfil', verificarAdministrador, perfilAdministrador);
router.post('/auth/logout', verificarAdministrador, logoutAdministrador);
router.get('/resumen', verificarAdministrador, resumen);
router.get('/inquilinos', verificarAdministrador, listarInquilinos);
router.post('/inquilinos', verificarAdministrador, registrarInquilino);
router.get('/inquilinos/:idInquilino', verificarAdministrador, detalleInquilino);
router.get('/propiedades', verificarAdministrador, buscarPropiedades);
router.post('/administradores', verificarAdministrador, crearAdministrador);
router.patch('/administradores/:idAdministrador/activo', verificarAdministrador,
  cambiarEstadoAdministrador);
router.get('/disponibilidad', verificarAdministrador, consultarDisponibilidad);
router.put('/disponibilidad/fechas/:fecha', verificarAdministrador, cambiarFecha);
router.put('/disponibilidad/fechas/:fecha/horarios/:hora',
  verificarAdministrador, cambiarHorario);
router.get('/citas', verificarAdministrador, listarCitas);
router.post('/citas/:idCita/:accion', verificarAdministrador, ejecutarAccion);

module.exports = router;
