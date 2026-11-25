// Fuente única para la validación del servidor y la página de recuperación.
// Las cuentas existentes se comprueban con bcrypt sin aplicar esta política al login.
((raiz, fabrica) => {
  const politica = fabrica();
  if (typeof module !== 'undefined' && module.exports) module.exports = politica;
  if (raiz && typeof window !== 'undefined') raiz.VLPasswordPolicy = politica;
})(typeof globalThis !== 'undefined' ? globalThis : null, () => {
  const especiales = '!@#$%&*_-+=?.:';
  const permitidos = /^[A-Za-z0-9!@#$%&*_=?.:+-]+$/;
  const evaluarPassword = (valor) => {
    const texto = typeof valor === 'string' ? valor : '';
    const bytes = typeof TextEncoder !== 'undefined'
      ? new TextEncoder().encode(texto).length
      : Buffer.byteLength(texto, 'utf8');
    const requisitos = {
      longitud: texto.length >= 8,
      mayuscula: /[A-Z]/.test(texto),
      numero: /[0-9]/.test(texto),
      especial: [...texto].some((caracter) => especiales.includes(caracter)),
      caracteres: texto.length > 0 && permitidos.test(texto),
      bytes: bytes <= 72,
    };
    return { valida: Object.values(requisitos).every(Boolean), requisitos };
  };
  return { evaluarPassword };
});
