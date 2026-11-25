const HOST_PRUEBAS = 'ep-sparkling-waterfall-b4gyj26e-pooler.c-6.us-east-2.aws.neon.tech';
const CLAVES_PRIVADAS = ['JWT_SECRET', 'ADMIN_JWT_SECRET',
  'RECOVERY_RATE_LIMIT_SECRET'];
const CLAVES_ARCHIVO = new Set(['DATABASE_URL', ...CLAVES_PRIVADAS]);
const CLAVES_SISTEMA = ['PATH', 'Path', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP',
  'TMPDIR', 'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'LANG', 'TERM'];

const validarDatabaseUrlPruebas = (valor) => {
  try {
    const url = new URL(valor);
    if (!['postgres:', 'postgresql:'].includes(url.protocol) ||
        url.hostname !== HOST_PRUEBAS || (url.port && url.port !== '5432') ||
        !url.username || !url.password || url.pathname.length < 2 ||
        url.hash || [...url.searchParams.keys()].some((clave) =>
          !['sslmode', 'channel_binding'].includes(clave)) ||
        !['require', 'verify-full'].includes(url.searchParams.get('sslmode')) ||
        url.searchParams.getAll('sslmode').length !== 1 ||
        url.searchParams.getAll('channel_binding').length > 1 ||
        url.searchParams.has('channel_binding') &&
          url.searchParams.get('channel_binding') !== 'require') {
      throw new Error('URL no autorizada');
    }
    return true;
  } catch (_) {
    throw new Error('DATABASE_URL no corresponde a la rama de pruebas autorizada');
  }
};

const validarArchivoPruebas = (variables) => {
  if (Object.keys(variables).some((clave) => !CLAVES_ARCHIVO.has(clave))) {
    throw new Error('El archivo de pruebas contiene variables no permitidas');
  }
  validarDatabaseUrlPruebas(variables.DATABASE_URL);
  for (const clave of CLAVES_PRIVADAS) {
    if (typeof variables[clave] !== 'string' ||
        Buffer.byteLength(variables[clave], 'utf8') < 32) {
      throw new Error('Falta un secreto independiente del entorno de pruebas');
    }
  }
  if (new Set(CLAVES_PRIVADAS.map((clave) => variables[clave])).size !== 3) {
    throw new Error('Los secretos de pruebas deben ser distintos');
  }
  return true;
};

const conexionConVerificacionCompleta = (valor) => {
  validarDatabaseUrlPruebas(valor);
  const url = new URL(valor);
  url.searchParams.set('sslmode', 'verify-full');
  return url.toString();
};

const crearEntornoAislado = (variables, origen = process.env) => {
  validarArchivoPruebas(variables);
  const entorno = {};
  for (const clave of CLAVES_SISTEMA) {
    if (origen[clave] !== undefined) entorno[clave] = origen[clave];
  }
  return { ...entorno, ...variables,
    DATABASE_URL: conexionConVerificacionCompleta(variables.DATABASE_URL),
    PORT: '3000',
    VLCLIENT_TEST_MODE: '1', PUSH_REMOTE_ENABLED: 'false' };
};

const afirmarProcesoPruebas = (entorno = process.env) => {
  validarArchivoPruebas(Object.fromEntries(['DATABASE_URL', ...CLAVES_PRIVADAS]
    .map((clave) => [clave, entorno[clave]])));
  if (new URL(entorno.DATABASE_URL).searchParams.get('sslmode') !== 'verify-full' ||
      entorno.PORT !== '3000' ||
      ['RESEND_API_KEY', 'RECOVERY_MAIL_FROM', 'RECOVERY_PUBLIC_URL',
        'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY',
        'CLOUDINARY_API_SECRET', 'CLOUDINARY_URL', 'EXPO_ACCESS_TOKEN',
        'EXPO_PROJECT_ID'].some((clave) => entorno[clave]) ||
      entorno.PUSH_REMOTE_ENABLED === 'true') {
    throw new Error('El proceso de pruebas contiene configuración externa no permitida');
  }
};

module.exports = { HOST_PRUEBAS, CLAVES_PRIVADAS, validarDatabaseUrlPruebas,
  conexionConVerificacionCompleta,
  validarArchivoPruebas, crearEntornoAislado, afirmarProcesoPruebas };
