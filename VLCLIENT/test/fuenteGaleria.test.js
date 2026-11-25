const test = require('node:test');
const assert = require('node:assert/strict');
const { fuenteGaleria } = require('../src/admin/fuenteGaleria');

test('el entorno aislado usa solo recursos locales de prueba', () => {
  const foto = { url_foto: 'https://res.cloudinary.com/demo/real.jpg',
    url_miniatura: 'https://res.cloudinary.com/demo/mini.jpg' };
  const locales = [11, 22];
  assert.equal(fuenteGaleria(foto, true, 0, true, locales), 11);
  assert.equal(fuenteGaleria(foto, false, 1, true, locales), 22);
});

test('fuera de pruebas se usan las fotos reales y sus miniaturas', () => {
  const foto = { url_foto: 'https://res.cloudinary.com/demo/real.jpg',
    url_miniatura: 'https://res.cloudinary.com/demo/mini.jpg' };
  assert.deepEqual(fuenteGaleria(foto, true, 0, false, [11]),
    { uri: foto.url_miniatura });
  assert.deepEqual(fuenteGaleria(foto, false, 0, false, [11]),
    { uri: foto.url_foto });
});
