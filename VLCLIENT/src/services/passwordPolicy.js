// Espejo visual de la política del backend; el servidor siempre vuelve a validar.
const especiales = '!@#$%&*_-+=?.:';
const permitidos = /^[A-Za-z0-9!@#$%&*_=?.:+-]+$/;
const evaluarPassword = (valor) => {
  const texto = typeof valor === 'string' ? valor : '';
  const bytes = [...texto].reduce((total, caracter) => {
    const punto = caracter.codePointAt(0);
    return total + (punto <= 0x7f ? 1 : punto <= 0x7ff ? 2 :
      punto <= 0xffff ? 3 : 4);
  }, 0);
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
module.exports = { evaluarPassword };
