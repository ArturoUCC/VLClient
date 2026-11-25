const test = require('node:test');
const assert = require('node:assert/strict');
const { RENDER_API_URL, elegirApiUrl } = require('../src/services/apiConfig');

test('fuera del modo pruebas conserva la URL de Render', () => {
  assert.equal(elegirApiUrl(undefined, undefined), RENDER_API_URL);
  assert.equal(elegirApiUrl('http://192.168.1.5:3000/api', '0'), RENDER_API_URL);
});

test('modo pruebas solo acepta la API local en una IP privada', () => {
  assert.equal(elegirApiUrl('http://192.168.1.5:3000/api', '1'),
    'http://192.168.1.5:3000/api');
  for (const url of [RENDER_API_URL, 'http://127.0.0.1:3000/api',
    'http://8.8.8.8:3000/api', 'http://192.168.1.5:3001/api',
    'http://192.168.1.5:3000/api?destino=render']) {
    assert.throws(() => elegirApiUrl(url, '1'));
  }
});
