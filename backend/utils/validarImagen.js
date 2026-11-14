const firmas = {
  'image/jpeg': (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': (b) => b.length >= 8 &&
    b.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')),
  'image/webp': (b) => b.length >= 12 &&
    b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP',
  'image/heic': (b) => esHeif(b, new Set(['heic', 'heix', 'hevc', 'hevx'])),
  'image/heif': (b) => esHeif(b, new Set(['mif1', 'msf1', 'heic', 'heix'])),
};

function esHeif(buffer, marcas) {
  if (buffer.length < 12 || buffer.toString('ascii', 4, 8) !== 'ftyp') return false;
  const tamano = buffer.readUInt32BE(0);
  if (tamano < 16 || tamano > buffer.length) return false;
  for (let i = 8; i + 4 <= Math.min(tamano, 64); i += 4) {
    if (marcas.has(buffer.toString('ascii', i, i + 4))) return true;
  }
  return false;
}

const imagenValida = (archivo) =>
  Buffer.isBuffer(archivo?.buffer) &&
  typeof firmas[archivo.mimetype] === 'function' &&
  firmas[archivo.mimetype](archivo.buffer);

module.exports = { imagenValida };
