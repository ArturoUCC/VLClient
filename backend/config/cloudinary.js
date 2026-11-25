if (process.env.VLCLIENT_TEST_MODE === '1') {
  const noDisponible = () => { throw new Error('Cloudinary deshabilitado en pruebas'); };
  module.exports = { uploader: { upload_stream: noDisponible, destroy: noDisponible },
    api: { resource: noDisponible } };
} else {
  const { v2: cloudinary } = require('cloudinary');

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });

  module.exports = cloudinary;
}
