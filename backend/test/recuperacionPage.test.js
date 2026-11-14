const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { enviarRecuperacion } = require('../services/correoRecuperacionService');
const pagina = require('../routes/recuperacionPageRoutes');

test('la página y sus recursos no se almacenan ni envían referer', async () => {
  const app = express();
  app.use('/recuperar-password', pagina);
  const servidor = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => servidor.once('listening', resolve));
  try {
    const base = `http://127.0.0.1:${servidor.address().port}`;
    for (const ruta of ['/recuperar-password', '/recuperar-password/estilos.css',
      '/recuperar-password/app.js']) {
      const respuesta = await fetch(base + ruta);
      assert.equal(respuesta.status, 200);
      assert.match(respuesta.headers.get('cache-control'), /no-store/);
      assert.equal(respuesta.headers.get('referrer-policy'), 'no-referrer');
      assert.match(respuesta.headers.get('content-security-policy'), /connect-src 'self'/);
    }
    const html = await (await fetch(base + '/recuperar-password')).text();
    assert.match(html, /id="confirmacion"/);
    assert.match(html, /id="password"/);
  } finally {
    await new Promise((resolve) => servidor.close(resolve));
  }
});

test('el correo lleva el token en el fragmento y no en la petición HTTP', async () => {
  const anteriores = {
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RECOVERY_MAIL_FROM: process.env.RECOVERY_MAIL_FROM,
    RECOVERY_PUBLIC_URL: process.env.RECOVERY_PUBLIC_URL
  };
  const fetchAnterior = global.fetch;
  let enlace;
  process.env.RESEND_API_KEY = 'clave-de-prueba';
  process.env.RECOVERY_MAIL_FROM = 'VLClient <noreply@example.test>';
  process.env.RECOVERY_PUBLIC_URL = 'https://vlclient-backend.onrender.com/recuperar-password';
  global.fetch = async (_url, opciones) => {
    const texto = JSON.parse(opciones.body).text;
    enlace = new URL(texto.match(/https:\/\/[^\s]+/)[0]);
    return { ok: true };
  };
  try {
    await enviarRecuperacion('inquilino@example.test', 'a'.repeat(64));
    assert.equal(enlace.search, '');
    assert.equal(enlace.hash, `#token=${'a'.repeat(64)}`);
    assert.equal(enlace.pathname, '/recuperar-password');
    process.env.RECOVERY_PUBLIC_URL = 'https://otro-dominio.test/recuperar-password';
    await assert.rejects(
      enviarRecuperacion('inquilino@example.test', 'a'.repeat(64)),
      /URL pública de recuperación inválida/
    );
  } finally {
    global.fetch = fetchAnterior;
    for (const [clave, valor] of Object.entries(anteriores)) {
      if (valor === undefined) delete process.env[clave];
      else process.env[clave] = valor;
    }
  }
});
