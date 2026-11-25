const { spawn } = require('node:child_process');
const path = require('node:path');
const { elegirApiUrl } = require('../src/services/apiConfig');

const comprobar = process.argv[2] === '--check';
const ip = process.argv[comprobar ? 3 : 2];
if (process.argv.length !== (comprobar ? 4 : 3)) {
  console.error('Uso: npm run start:pruebas -- [--check] <IP_PRIVADA_DEL_PC>');
  process.exitCode = 2;
} else {
  try {
    const apiUrl = elegirApiUrl(`http://${ip}:3000/api`, '1');
    const entorno = {};
    for (const clave of ['PATH', 'Path', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP',
      'TMPDIR', 'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'LANG', 'TERM']) {
      if (process.env[clave] !== undefined) entorno[clave] = process.env[clave];
    }
    Object.assign(entorno, {
      EXPO_NO_DOTENV: '1',
      EXPO_PUBLIC_API_URL: apiUrl,
      EXPO_PUBLIC_VLCLIENT_TEST_MODE: '1',
    });
    if (comprobar) {
      console.log('Expo usará una API local privada; Render queda excluido');
    } else {
      const cli = require.resolve('expo/bin/cli');
      const hijo = spawn(process.execPath, [cli, 'start', '--clear', '--lan'], {
        cwd: path.resolve(__dirname, '..'), env: entorno, stdio: 'inherit',
      });
      hijo.on('error', () => {
        console.error('No se pudo iniciar Expo en modo pruebas');
        process.exitCode = 1;
      });
      hijo.on('exit', (codigo) => { process.exitCode = codigo ?? 1; });
      for (const señal of ['SIGINT', 'SIGTERM']) {
        process.on(señal, () => { if (!hijo.killed) hijo.kill(señal); });
      }
    }
  } catch (_) {
    console.error('Se requiere una dirección IPv4 privada del equipo');
    process.exitCode = 2;
  }
}
