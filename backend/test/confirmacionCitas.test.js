const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sql = fs.readFileSync(
  path.join(__dirname, '..', 'sql', 'confirmar_cita_mantenimiento.sql'),
  'utf8'
);

test('la confirmación exige una cita programada y el inquilino indicado', () => {
  assert.match(sql, /JOIN public\.reportes AS r ON r\.id_reporte = ci\.id_reporte/);
  assert.match(sql, /JOIN public\.contratos AS c ON c\.id_contrato = r\.id_contrato/);
  assert.match(sql, /WHERE ci\.id_cita = 0[\s\S]*?AND c\.id_inquilino = 0/);
  assert.match(sql, /UPDATE public\.citas AS ci[\s\S]*?SET estado = 'confirmada'[\s\S]*?AND ci\.estado = 'programada'/);
});

test('la notificación depende de la cita realmente actualizada', () => {
  assert.match(sql, /INSERT INTO public\.notificaciones/);
  assert.match(sql, /FROM cita_confirmada AS cc\s+JOIN objetivo AS o/);
  assert.match(sql, /\(SELECT id_notificacion FROM aviso\)/);
});
