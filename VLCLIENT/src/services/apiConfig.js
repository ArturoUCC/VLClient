const RENDER_API_URL = 'https://vlclient-backend.onrender.com/api';

const ipPrivada = (hostname) => {
  const partes = hostname.split('.');
  if (partes.length !== 4 || partes.some((parte) =>
    !/^\d{1,3}$/.test(parte) || Number(parte) > 255)) return false;
  const [a, b] = partes.map(Number);
  return a === 10 || a === 172 && b >= 16 && b <= 31 ||
    a === 192 && b === 168;
};

const elegirApiUrl = (urlPruebas, modoPruebas) => {
  if (modoPruebas !== '1') return RENDER_API_URL;
  try {
    const url = new URL(urlPruebas);
    if (url.protocol !== 'http:' || !ipPrivada(url.hostname) ||
        url.port !== '3000' || url.pathname !== '/api' ||
        url.search || url.hash || url.username || url.password) {
      throw new Error('URL de pruebas inválida');
    }
    return url.toString().replace(/\/$/, '');
  } catch (_) {
    throw new Error('La API de pruebas debe estar en una IP privada y puerto 3000');
  }
};

module.exports = { RENDER_API_URL, ipPrivada, elegirApiUrl };
