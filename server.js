const express = require("express");
const cors = require("cors");
const {
  connectToDatabase,
  obtenerComentarios,
  obtenerComentarioPorId,
  obtenerComentarioPorEmail,
  agregarComentario,
  actualizarComentario,
  eliminarComentario,
  eliminarTodos
} = require("./db");

const app = express();
const port = process.env.PORT || 3000;

app.use(cors()); // Permite conexiones desde cualquier origen
app.use(express.json()); // Middleware para recibir JSON

connectToDatabase();

// Obtiene y muestra comentarios
app.get("/comentarios", async (req, res) => {
  try {
    const { id, email } = req.query;
    if (id) res.json({ comentarios: await obtenerComentarioPorId(id) });
    else if (email)
      res.json({ comentarios: await obtenerComentarioPorEmail(email) });
    else res.json({ comentarios: await obtenerComentarios() });
  } catch (error) {
    res.json({ error: "Error al obtener comentarios: " + error.message });
  }
});

// Agrega un comentario
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
    await agregarComentario(fecha, apellido, nombre, email, asunto, mensaje);
    res.json({
      mensaje: "Comentario agregado: ",
      datos: {
        fecha: fecha,
        apellido: apellido,
        nombre: nombre,
        email: email,
        asunto: asunto,
        mensaje: mensaje,
      },
    });
  } catch (error) {
    res.json({ error: "Error al agregar comentario: " + error.message });
  }
});

// Actualiza un comentario
app.put("/editar/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { apellido, nombre, email, asunto, mensaje } = req.body;
    const comentario = await obtenerComentarioPorId(id);
    if (comentario[0] === undefined) {
      res.json({ error: "Comentario no encontrado" });
    } else {
      await actualizarComentario(
        comentario[0]._id.toString(),
        apellido,
        nombre,
        email,
        asunto,
        mensaje
      );
      res.json({
        mensaje: "Comentario actualizado",
        datos: {
          fecha: comentario[0].fecha,
          apellido: apellido,
          nombre: nombre,
          email: email,
          asunto: asunto,
          mensaje: mensaje,
        },
      });
    }
  } catch (error) {
    res.json({ error: "Error al actualizar comentario: " + error.message });
  }
});

// Elimina un comentario
app.delete("/eliminar/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const comentario = await obtenerComentarioPorId(id);
    if (comentario[0] === undefined) {
      res.json({ error: "Comentario no encontrado" });
    } else {
      await eliminarComentario(comentario[0]._id.toString());
      res.json({ mensaje: "Comentario eliminado" });
    }
  } catch (error) {
    res.json({ error: "Error al eliminar comentario: " + error.message });
  }
});

// Elimina todos los comentarios
app.delete("/eliminar", async (req, res) => {
  try {
    const comentarios = await eliminarTodos();
    if (comentarios.deletedCount > 0) {
      res
        .json({ mensaje: "Todos los comentarios fueron eliminados" });
    } else {
      res
        .json({ error: "No se encontraron comentarios para eliminar" });
    }
  } catch (error) {
    res.json({error: "Error al eliminar todos los comentarios: " + error.message});
  }
});

// Inicia el servidor en el puerto 3000
app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
});
