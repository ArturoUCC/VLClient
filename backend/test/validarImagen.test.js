const test = require('node:test');
const assert = require('node:assert/strict');
const { imagenValida } = require('../utils/validarImagen');

test('acepta firmas reales y rechaza MIME declarado que no coincide', () => {
  const jpeg = Buffer.from('ffd8ffe000104a464946', 'hex');
  const png = Buffer.from('89504e470d0a1a0a00000000', 'hex');
  const webp = Buffer.from('524946460000000057454250', 'hex');
  assert.equal(imagenValida({ mimetype: 'image/jpeg', buffer: jpeg }), true);
  assert.equal(imagenValida({ mimetype: 'image/png', buffer: png }), true);
  assert.equal(imagenValida({ mimetype: 'image/webp', buffer: webp }), true);
  assert.equal(imagenValida({ mimetype: 'image/jpeg', buffer: png }), false);
  assert.equal(imagenValida({ mimetype: 'image/png', buffer: Buffer.from('<script>') }), false);
  assert.equal(imagenValida({ mimetype: 'application/pdf', buffer: jpeg }), false);
});
