const { MongoClient } = require("mongodb");
const { MONGODB_USR, MONGODB_PWD } = require("./config.js");

const uri =
  "mongodb+srv://" +
  MONGODB_USR +
  ":" +
  MONGODB_PWD +
  "@cluster0.rntnac4.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

let coleccion;

//Función que conecta la Base de Datos
async function connectToDatabase() {
  try {
    await client.connect();
    const database = client.db("db");
    coleccion = database.collection("comentarios");
    console.log("Conectado a la base de datos");
  } catch (error) {
    console.error("Error al conectar a la base de datos:", error);
  }
}

//Función para obtener la colección
async function getCollection() {
  return await coleccion.find({}).toArray();
}

module.exports = { connectToDatabase, getCollection };
