require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 3000;
const pool = require('./config/db');
const inquilinosRoutes = require('./routes/inquilinosRoutes');
const estadosCuentaRoutes = require('./routes/estadosCuentaRoutes');
const authRoutes = require('./routes/authRoutes');
const perfilRoutes = require('./routes/perfilRoutes');
const pagosRoutes = require('./routes/pagosRoutes');

// Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());
//app.use('/api/inquilinos', inquilinosRoutes);
app.use('/api/estados-de-cuenta', estadosCuentaRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/perfil', perfilRoutes);
app.use('/api/pagos', pagosRoutes);

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



app.get('/api/db-test', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() AS fecha_servidor');

    res.json({
      mensaje: 'Conexión con PostgreSQL exitosa',
      fecha_servidor: result.rows[0].fecha_servidor,
    });
  } catch (error) {
    console.error('Error al conectar con PostgreSQL:', error.message);

    res.status(500).json({
      mensaje: 'No se pudo conectar con PostgreSQL',
    });
  }
});

