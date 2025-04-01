const { MongoClient, ObjectId } = require("mongodb");
const { MONGODB_USR, MONGODB_PWD } = require("./config.js");

const uri =
  "mongodb+srv://" +
  MONGODB_USR +
  ":" +
  MONGODB_PWD +
  "@cluster0.rntnac4.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

let comentarios;
let usuarios;

// Función que conecta la Base de Datos
async function connectToDatabase() {
  try {
    await client.connect();
    const database = client.db("db");
    usuarios = database.collection("usuarios");
    comentarios = database.collection("comentarios");
    console.log("Conectado a la base de datos");
  } catch (error) {
    console.error("Error al conectar a la base de datos:", error);
  }
}

async function obtenerUsuarios() {
    return await usuarios.find({}).toArray();
  }

// Función para obtener los comentarios
async function obtenerComentarios() {
  return await comentarios.find({}).toArray();
}

// Función para obtener los comentarios por ID
async function obtenerComentarioPorId(id) {
  return await comentarios.find({ _id: new ObjectId(id) }).toArray();
}

// Función para obtener los comentarios por email
async function obtenerComentarioPorEmail(email) {
  return await comentarios.find({ email: email }).toArray();
}

// Función para agregar un comentario
async function agregarComentario(
  fecha,
  apellido,
  nombre,
  email,
  asunto,
  mensaje
) {
  return await comentarios.insertOne({
    fecha: fecha,
    apellido: apellido,
    nombre: nombre,
    email: email,
    asunto: asunto,
    mensaje: mensaje,
  });
}

// Función para actualizar un comentario
async function actualizarComentario(
  id,
  apellido,
  nombre,
  email,
  asunto,
  mensaje
) {
  return await comentarios.updateOne(
    { _id: new ObjectId(id) },
    { $set: { apellido, nombre, email, asunto, mensaje } }
  );
}

// Función para eliminar un comentario
async function eliminarComentario(id) {
  return await comentarios.deleteOne({ _id: new ObjectId(id) });
}


// Función para eliminar un comentario
async function eliminarTodos() {
    return await comentarios.deleteMany();
  }

module.exports = {
  connectToDatabase,
  obtenerUsuarios,
  obtenerComentarios,
  obtenerComentarioPorId,
  obtenerComentarioPorEmail,
  agregarComentario,
  actualizarComentario,
  eliminarComentario,
  eliminarTodos
};
