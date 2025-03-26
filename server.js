const express = require("express");
const cors = require("cors");
const { ObjectId } = require("mongodb");
const { getCollection } = require("./db");
const { connectToDatabase } = require("./db");

const app = express();
const port = process.env.PORT || 3000;

app.use(cors()); // Permite conexiones desde el frontend
app.use(express.json()); // Middleware para recibir JSON

connectToDatabase();

//Obtiene y muestra comentarios
app.get("/", async (req, res) => {
    try {
        const { id, email } = req.query;
        const coleccion = await getCollection();
        let comentarios;
        if (id) {
          comentarios = await coleccion.find({ _id: new ObjectId(id) }).toArray();
        } else if (email) {
          comentarios = await coleccion.find({ email: email }).toArray();
        } else {
          comentarios = await coleccion.find().toArray();
        }
        res.json({
            coleccion: coleccion,
        });
      } catch (error) {
        console.error(
          "Error interno del servidor - Error al buscar comentarios: ",
          error.message
        );
        res
          .status(500)
          .send(
            "Error interno del servidor - Error al buscar comentarios: " +
              error.message
          );
      }
});

//Agrega un comentario
app.post("/agregar", async (req, res) => {
  try {
    const opciones = {
      timeZone: "America/Argentina/Buenos_Aires",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    };
    const fecha = new Date().toLocaleString("es-AR", opciones);
    const { apellido, nombre, email, asunto, mensaje } = req.body;
    const coleccion = getCollection();
    await coleccion.insertOne({
      fecha,
      apellido,
      nombre,
      email,
      asunto,
      mensaje,
    });
    res.redirect("/");
  } catch (error) {
    console.error(
      "Error interno del servidor - Error al agregar comentarios: ",
      error.message
    );
    res
      .status(500)
      .send(
        "Error interno del servidor - Error al agregar comentarios: " +
          error.message
      );
  }
});

//Actualiza un comentario
app.put("/editar/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { apellido, nombre, email, asunto, mensaje } = req.body;
    const coleccion = getCollection();
    const result = await coleccion.updateOne(
      { _id: new ObjectId(id) },
      { $set: { apellido, nombre, email, asunto, mensaje } }
    );
    if (result.matchedCount === 1) {
      res.status(200).send("Comentario actualizado");
    } else {
      res.status(404).send("Comentario no encontrado");
    }
  } catch (error) {
    console.error(
      "Error interno del servidor - Error al actualizar comentarios: ",
      error.message
    );
    res
      .status(500)
      .send(
        "Error interno del servidor - Error al actualizar comentarios: " +
          error.message
      );
  }
});

//Elimina un comentario
app.delete("/eliminar/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const coleccion = getCollection();
    const result = await coleccion.deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 1) {
      res.status(200).send("Comentario eliminado");
    } else {
      res.status(404).send("Comentario no encontrado");
    }
  } catch (error) {
    console.error(
      "Error interno del servidor - Error al eliminar comentarios: ",
      error.message
    );
    res
      .status(500)
      .send(
        "Error interno del servidor - Error al eliminar comentarios: " +
          error.message
      );
  }
});

//Elimina todos los comentarios
app.delete("/eliminarTodos", async (req, res) => {
  try {
    const coleccion = getCollection();
    const result = await coleccion.deleteMany({});
    if (result.deletedCount > 0) {
      res.status(200).send("Comentarios eliminados");
    } else {
      res.status(404).send("No se encontraron comentarios");
    }
  } catch (error) {
    console.error(
      "Error interno del servidor - Error al eliminar comentarios: ",
      error.message
    );
    res
      .status(500)
      .send(
        "Error interno del servidor - Error al eliminar comentarios: " +
          error.message
      );
  }
});

//Inicia el servidor en el puerto 3000
app.listen(port, () => {
  console.log(`App escuchando en http://localhost:${port}`);
});
