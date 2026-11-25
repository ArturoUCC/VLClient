const readline = require('node:readline');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { evaluarPassword } = require('../utils/passwordPolicy');

if (process.env.VLCLIENT_TEST_MODE !== '1' || !process.stdin.isTTY ||
    !process.stdin.setRawMode) {
  console.error('Esta operación requiere el entorno de pruebas y una terminal interactiva');
  process.exitCode = 1;
  void pool.end();
} else {
  const preguntar = (titulo, oculto = false) => new Promise((resolve, reject) => {
    let valor = '';
    process.stdout.write(titulo);
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    const tecla = (caracter, datos) => {
      if (datos?.ctrl && datos.name === 'c') {
        process.stdin.off('keypress', tecla);
        process.stdin.setRawMode(false);
        reject(new Error('Cancelado'));
      } else if (datos?.name === 'return' || datos?.name === 'enter') {
        process.stdin.off('keypress', tecla);
        process.stdin.setRawMode(false);
        process.stdout.write('\n');
        resolve(valor);
      } else if (datos?.name === 'backspace') {
        if (valor) { valor = valor.slice(0, -1); if (!oculto) process.stdout.write('\b \b'); }
      } else if (typeof caracter === 'string' && !datos?.ctrl && !datos?.meta) {
        valor += caracter;
        if (!oculto) process.stdout.write(caracter);
      }
    };
    process.stdin.on('keypress', tecla);
  });

  (async () => {
    const nombre = (await preguntar('Nombre: ')).trim();
    const apellido = (await preguntar('Apellido: ')).trim();
    const correo = (await preguntar('Correo electrónico: ')).trim().toLowerCase();
    let password = await preguntar('Contraseña (oculta): ', true);
    let confirmacion = await preguntar('Confirma contraseña (oculta): ', true);
    if (!nombre || nombre.length > 100 || !apellido || apellido.length > 100 ||
        correo.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo) ||
        !evaluarPassword(password).valida || password !== confirmacion) {
      throw new Error('Datos o contraseña inválidos');
    }
    confirmacion = '';
    const hash = await bcrypt.hash(password, 12);
    password = '';
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('LOCK TABLE administradores IN SHARE ROW EXCLUSIVE MODE');
      const existente = await client.query('SELECT 1 FROM administradores LIMIT 1');
      if (existente.rows.length) throw new Error('Ya existe un administrador');
      const creado = await client.query(
        `INSERT INTO administradores(nombre,apellido,correo,password_hash)
         VALUES($1,$2,$3,$4) RETURNING id_administrador`,
        [nombre, apellido, correo, hash]);
      await client.query(
        `INSERT INTO bitacora_administrativa
         (id_administrador,accion,entidad,entidad_id)
         VALUES($1,'crear_administrador_inicial','administradores',$1)`,
        [creado.rows[0].id_administrador]);
      await client.query('COMMIT');
      console.log('Primer administrador creado en la rama de pruebas');
    } catch (_) {
      await client.query('ROLLBACK').catch(() => {});
      throw new Error('No se creó el administrador; revisa la configuración y los datos');
    } finally { client.release(); }
  })().catch((error) => {
    console.error(['Cancelado', 'Datos o contraseña inválidos',
      'No se creó el administrador; revisa la configuración y los datos']
      .includes(error.message) ? error.message :
      'No se creó el administrador de pruebas');
    process.exitCode = 1;
  }).finally(async () => {
    process.stdin.pause();
    await pool.end();
  });
}
