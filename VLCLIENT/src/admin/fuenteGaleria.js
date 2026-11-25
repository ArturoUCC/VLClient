const fuenteGaleria = (foto, miniatura, posicion, pruebas, imagenesLocales) => {
  if (pruebas) return imagenesLocales[posicion % imagenesLocales.length];
  return { uri: miniatura ? foto.url_miniatura || foto.url_foto : foto.url_foto };
};

module.exports = { fuenteGaleria };
