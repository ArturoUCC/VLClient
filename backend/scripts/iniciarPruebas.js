const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const dotenv = require('dotenv');
const { crearEntornoAislado } = require('../config/entornoPruebas');

const archivo = path.resolve(__dirname, '../.env.pruebas');
const argumento = process.argv[2];
if (process.argv.length > 3 ||
    argumento && !['--check', '--check-db', '--crear-admin'].includes(argumento)) {
  console.error('Uso: npm run dev:pruebas [-- --check|--check-db|--crear-admin]');
  process.exitCode = 2;
} else {
  try {
    const variables = dotenv.parse(fs.readFileSync(archivo));
    const entorno = crearEntornoAislado(variables);
    if (argumento === '--check') {
      console.log('Entorno de pruebas aislado y hostname autorizado');
    } else {
      const destino = argumento === '--crear-admin' ?
        path.resolve(__dirname, './crearPrimerAdministradorPruebas.js') :
        argumento === '--check-db' ?
          path.resolve(__dirname, './comprobarConexionPruebas.js') :
          path.resolve(__dirname, '../server.js');
      const hijo = spawn(process.execPath, [destino], {
        cwd: path.resolve(__dirname, '..'), env: entorno, stdio: 'inherit',
      });
      hijo.on('error', () => {
        console.error('No se pudo iniciar el proceso de pruebas');
        process.exitCode = 1;
      });
      hijo.on('exit', (codigo) => { process.exitCode = codigo ?? 1; });
      for (const señal of ['SIGINT', 'SIGTERM']) {
        process.on(señal, () => { if (!hijo.killed) hijo.kill(señal); });
      }
    }
  } catch (_) {
    console.error('Configuración de pruebas inválida o incompleta; no se inició el backend');
    process.exitCode = 1;
  }
}
