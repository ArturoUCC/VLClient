require('dotenv').config();

const express = require('express');
const helmet = require('helmet');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;
const inquilinosRoutes = require('./routes/inquilinosRoutes');
const estadosCuentaRoutes = require('./routes/estadosCuentaRoutes');
const authRoutes = require('./routes/authRoutes');
const perfilRoutes = require('./routes/perfilRoutes');
const pagosRoutes = require('./routes/pagosRoutes');
const reportesRoutes = require('./routes/reportesRoutes');
const reporteFotosRoutes = require('./routes/reporteFotosRoutes');
const citasRoutes = require('./routes/citasRoutes');
const notificacionesRoutes = require('./routes/notificacionesRoutes');
const pushDispositivosRoutes = require('./routes/pushDispositivosRoutes');
const recuperacionPageRoutes = require('./routes/recuperacionPageRoutes');

// Middlewares
app.use(helmet());
// La app nativa no necesita CORS y la página de recuperación usa el mismo origen.
app.use(express.json());
app.use('/recuperar-password', recuperacionPageRoutes);
//app.use('/api/inquilinos', inquilinosRoutes);
app.use('/api/estados-de-cuenta', estadosCuentaRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/perfil', perfilRoutes);
app.use('/api/pagos', pagosRoutes);
app.use('/api/reportes', reportesRoutes);
app.use('/api/reporte-fotos', reporteFotosRoutes);
app.use('/api/citas', citasRoutes);
app.use('/api/notificaciones', notificacionesRoutes);
app.use('/api/push', pushDispositivosRoutes);

// Ruta para comprobar que funciona la API
app.get('/api', (req, res) => {
  res.json({
    mensaje: 'API de VLClient funcionando correctamente',
    proyecto: 'Vives Lara',
    version: '1.0.0'
  });
});

// Iniciar servidor

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor VLClient ejecutándose en puerto ${PORT}`);
});
