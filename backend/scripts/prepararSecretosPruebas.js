// Solo añade secretos aleatorios al archivo local ignorado por Git.
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const dotenv = require('dotenv');
const { CLAVES_PRIVADAS, validarDatabaseUrlPruebas,
  validarArchivoPruebas } = require('../config/entornoPruebas');

try {
  const archivo = path.resolve(__dirname, '../.env.pruebas');
  const original = fs.readFileSync(archivo, 'utf8');
  const variables = dotenv.parse(original);
  validarDatabaseUrlPruebas(variables.DATABASE_URL);
  if (Object.keys(variables).some((clave) =>
    !['DATABASE_URL', ...CLAVES_PRIVADAS].includes(clave))) {
    throw new Error('Variables no autorizadas');
  }
  const faltantes = CLAVES_PRIVADAS.filter((clave) => !variables[clave]);
  if (faltantes.length) {
    const linea = original.endsWith('\n') ? '' : '\n';
    const nuevos = Object.fromEntries(faltantes.map((clave) =>
      [clave, randomBytes(48).toString('base64url')]));
    validarArchivoPruebas({ ...variables, ...nuevos });
    fs.appendFileSync(archivo, linea + faltantes.map((clave) =>
      `${clave}=${nuevos[clave]}\n`).join(''), { mode: 0o600 });
  } else {
    validarArchivoPruebas(variables);
  }
  try { fs.chmodSync(archivo, 0o600); } catch (_) { /* ACL de Windows */ }
  console.log('Secretos locales de pruebas preparados sin mostrarlos');
} catch (_) {
  console.error('No se pudieron preparar los secretos de pruebas');
  process.exitCode = 1;
}
