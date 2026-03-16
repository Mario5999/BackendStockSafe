const fs = require('fs');
const path = require('path');

const DB_FILE_PATH = path.join(__dirname, 'local-db.json');

const defaultData = {
  restaurantes: [],
  usuariosSistema: [],
  secciones: [],
  productos: [],
};

function normalizeData(data) {
  return {
    restaurantes: Array.isArray(data?.restaurantes) ? data.restaurantes : [],
    usuariosSistema: Array.isArray(data?.usuariosSistema) ? data.usuariosSistema : [],
    secciones: Array.isArray(data?.secciones) ? data.secciones : [],
    productos: Array.isArray(data?.productos) ? data.productos : [],
  };
}

function loadData() {
  try {
    if (!fs.existsSync(DB_FILE_PATH)) {
      fs.writeFileSync(DB_FILE_PATH, JSON.stringify(defaultData, null, 2), 'utf8');
      return { ...defaultData };
    }

    const raw = fs.readFileSync(DB_FILE_PATH, 'utf8');
    const parsed = raw ? JSON.parse(raw) : defaultData;

    return normalizeData(parsed);
  } catch (error) {
    console.error('[Store] No se pudo cargar local-db.json, usando valores por defecto.', error);
    return { ...defaultData };
  }
}

const persistedData = loadData();

const store = {
  ...persistedData,
  save() {
    const dataToPersist = {
      restaurantes: this.restaurantes,
      usuariosSistema: this.usuariosSistema,
      secciones: this.secciones,
      productos: this.productos,
    };

    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(dataToPersist, null, 2), 'utf8');
  },
};

module.exports = store;