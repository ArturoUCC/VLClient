// Ejecutar localmente en una terminal interactiva: node scripts/generarHashAdministrador.js
// Nunca recibe la contraseña por argumento, archivo o variable de entorno.
const readline = require('node:readline');
const bcrypt = require('bcryptjs');
const { evaluarPassword } = require('../utils/passwordPolicy');

if (!process.stdin.isTTY || !process.stdin.setRawMode) {
  process.stderr.write('Se requiere una terminal interactiva.\n');
  process.exitCode = 1;
} else {
  const preguntar = (titulo) => new Promise((resolve, reject) => {
    let valor = '';
    process.stdout.write(titulo);
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    const tecla = (caracter, datos) => {
      if (datos?.ctrl && datos.name === 'c') {
        process.stdin.off('keypress', tecla);
        process.stdin.setRawMode(false);
        valor = '';
        reject(new Error('Cancelado'));
      } else if (datos?.name === 'return' || datos?.name === 'enter') {
        process.stdin.off('keypress', tecla);
        process.stdin.setRawMode(false);
        process.stdout.write('\n');
        resolve(valor);
      } else if (datos?.name === 'backspace') {
        valor = valor.slice(0, -1);
      } else if (typeof caracter === 'string' && !datos?.ctrl && !datos?.meta) {
        valor += caracter;
      }
    };
    process.stdin.on('keypress', tecla);
  });

  (async () => {
    let primera = await preguntar('Nueva contraseña administrativa (entrada oculta): ');
    if (!evaluarPassword(primera).valida) {
      throw new Error('La contraseña no cumple la política de 8 a 72 bytes.');
    }
    let segunda = await preguntar('Confirma la contraseña (entrada oculta): ');
    if (primera !== segunda) throw new Error('Las contraseñas no coinciden.');
    segunda = '';
    const hash = await bcrypt.hash(primera, 12);
    primera = '';
    process.stdout.write(`Hash bcrypt para el INSERT manual: ${hash}\n`);
    process.stdin.pause();
  })().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.stdin.pause();
    process.exitCode = 1;
  });
}
