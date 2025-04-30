// Express
const express = require("express");
// Cors
const cors = require("cors");
// Seguridad (JWT)
const jwt = require("jsonwebtoken");
const { SECRET_KEY } = require("./config.js");
// Buenas prácticas (Sanitización)
const {body, validationResult} = require('express-validator')
const sanitizeHtml = require('sanitize-html');
// Buenas prácticas (Limitación)
const rateLimit = require('express-rate-limit');
// Buenas prácticas (Logs)
const fs = require('fs');
const path = require('path');
const morgan = require('morgan');
// BD
const {
  connectToDatabase,
  registrarUsuario,
  obtenerUsuarios,
  obtenerComentarios,
  obtenerComentarioPorId,
  obtenerComentarioPorEmail,
  agregarComentario,
  actualizarComentario,
  eliminarComentario,
  eliminarTodos,
} = require("./db");

const app = express();
const port = process.env.PORT || 3000;
app.use(cors()); // Permite conexiones desde cualquier origen
app.use(express.json()); // Middleware para recibir JSON
connectToDatabase();

// Limitador de comentarios
const comentarioLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // Máximo 10 comentarios cada 15 min por IP
  message: "Demasiadas solicitudes. Por favor, intente más tarde.",
  statusCode: 429
});

// Generación del archivo de logs
const accessLogStream = fs.createWriteStream(
  path.join(__dirname, 'access.log'),
  { flags: 'a' }
);
app.use(morgan('combined', { stream: accessLogStream }));

// Ruta de registro
app.post("/registro", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res
        .status(400)
        .json({ message: "Ingrese su email y contraseña para el registro." });
    }

    // Validación de usuarios en BD
    const usuarios = await obtenerUsuarios();
    console.log(usuarios);
    const usuarioExistente = usuarios.find(
      (user) => user.username === username
    );
    if (usuarioExistente) {
      return res.status(409).json({
        mensaje:
          "El usuario ya existe. Por favor, utilice otro email para el registro.",
      });
    } else {
      await registrarUsuario(username, password);
      res.status(201).json({
        mensaje: "Usuario registrado.",
      });
    }
  } catch (error) {
    res.status(500).json({
      error:
        "Error interno del servidor - Error al registrar usuario: " +
        error.message,
    });
  }
});

// Ruta de ingreso
app.post("/ingreso", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: "Faltan credenciales." });
    }

    // Validación de usuarios en BD
    const usuarios = await obtenerUsuarios();
    const usuarioValido = usuarios.find(
      (user) => user.username === username && user.password === password
    );

    if (usuarioValido) {
      // Generar Token
      const token = jwt.sign(
        {
          id: usuarioValido.id,
          username: usuarioValido.username,
          rol: usuarioValido.rol,
        },
        SECRET_KEY,
        {
          expiresIn: "1h",
        }
      );

      res.status(200).json({ accessToken: token });
    } else {
      res.status(401).json({ mensaje: "Credenciales incorrectas." });
    }
  } catch (error) {
    res.status(500).json({
      error:
        "Error interno del servidor - Error al obtener usuarios: " +
        error.message,
    });
  }
});

// Middleware para verificar token
const verifyToken = (req, res, next) => {
  const token = req.headers["authorization"];
  if (!token) return res.status(403).json({ mensaje: "Token requerido." });

  jwt.verify(token.split(" ")[1], SECRET_KEY, (err, decoded) => {
    if (err) return res.status(401).json({ mensaje: "Token inválido." });

    req.user = decoded; // Guarda la info del usuario en la request
    next();
  });
};

// Middleware para verificar roles
const authorizeRole = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.rol)) {
      return res.status(403).json({ error: "Acceso no autorizado." });
    }
    next();
  };
};

// Obtiene y muestra comentarios
app.get(
  "/comentarios",
  verifyToken,
  authorizeRole(["admin", "usuario"]),
  async (req, res) => {
    try {
      const { id, email } = req.query;
      const comentarios = await obtenerComentarios();
      if (comentarios.length == 0)
        res.status(200).json({ mensaje: "No hay comentarios." });
      else {
        const comentarioPorId = await obtenerComentarioPorId(id);
        const comentariosPorEmail = await obtenerComentarioPorEmail(email);
        if (id) res.status(200).json({ comentario: comentarioPorId });
        else if (email)
          res.status(200).json({ comentarios: comentariosPorEmail });
        else res.status(200).json({ comentarios: comentarios });
      }
    } catch (error) {
      res.status(500).json({
        error:
          "Error interno del servidor - Error al obtener comentarios: " +
          error.message,
      });
    }
  }
);

// Agrega un comentario
app.post(
  "/agregar",
  comentarioLimiter,
  verifyToken,
  authorizeRole(["admin", "usuario"]),
  // Sanitización con express-validator y validacion de datos (modifico los mensajes para mejor compresión)
  [
  body("apellido")
    .isString().withMessage("El apellido debe ser un texto.")
    .trim().notEmpty().withMessage("El campo apellido es obligatorio.")
    .custom(value => {
      if (!/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]+$/.test(value)) { // Acepta letras y espacios
        throw new Error("El apellido contiene caracteres inválidos.");
      }
      return true;
    }),
  body("nombre")
    .isString().withMessage("El nombre debe ser un texto.")
    .trim().notEmpty().withMessage("El campo nombre es obligatorio.")
    .custom(value => {
      if (!/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]+$/.test(value)) { // Acepta letras y espacios
        throw new Error("El nombre contiene caracteres inválidos.");
      }
      return true;
    }),
  body("email")
    .isEmail().withMessage("Debe ingresar un email válido.")
    .normalizeEmail(),
  body("asunto")
    .isString().withMessage("El asunto debe ser un texto.")
    .trim().notEmpty().withMessage("El campo asunto es obligatorio.")
    .custom(value => {
      if (!/^[a-zA-ZzÁÉÍÓÚÜÑáéíóúüñ0-9\s]+$/.test(value)) { // Acepta letras, números yespacios
        throw new Error("El asunto contiene caracteres inválidos.");
      }
      return true;
    }),
  body("mensaje")
    .isString().withMessage("El mensaje debe ser un texto.")
    .trim().notEmpty().withMessage("El campo mensaje es obligatorio."),
],
  async (req, res) => {
    // Verificar errores de validación
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

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

      // Sanitizar campos del cuerpo
      const apellido = sanitizeHtml(req.body.apellido);
      const nombre = sanitizeHtml(req.body.nombre);
      const email = sanitizeHtml(req.body.email);
      const asunto = sanitizeHtml(req.body.asunto);
      const mensaje = sanitizeHtml(req.body.mensaje);

      await agregarComentario(fecha, apellido, nombre, email, asunto, mensaje);
      res.status(201).json({
        mensaje: "Comentario agregado.",
        datos: { fecha, apellido, nombre, email, asunto, mensaje },
      });
    } catch (error) {
      res.status(500).json({
        error:
          "Error interno del servidor - Error al agregar comentario: " +
          error.message,
      });
    }
  }
);

// Editar un comentario
app.put(
  "/editar/:id",
  verifyToken,
  authorizeRole(["admin", "usuario"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      let { apellido, nombre, asunto, mensaje } = req.body;
      const comentario = await obtenerComentarioPorId(id);
      if (comentario.length == 0)
        res.status(404).json({ mensaje: "Comentario no encontrado." });
      if (
        req.user.rol === "usuario" &&
        req.user.username !== comentario[0].email
      ) {
        return res
          .status(403)
          .json({ mensaje: "No tienes permiso para editar este comentario." });
      } else {
        if (!apellido) apellido = comentario[0].apellido;
        if (!nombre) nombre = comentario[0].nombre;
        if (!asunto) asunto = comentario[0].asunto;
        if (!mensaje) mensaje = comentario[0].mensaje;
        await actualizarComentario(
          comentario[0]._id.toString(),
          apellido,
          nombre,
          asunto,
          mensaje
        );
        res.status(200).json({
          mensaje: "Comentario actualizado.",
          datos: {
            fecha: comentario[0].fecha,
            apellido: apellido,
            nombre: nombre,
            email: comentario[0].email,
            asunto: asunto,
            mensaje: mensaje,
          },
        });
      }
    } catch (error) {
      res.status(500).json({
        error:
          "Error interno del servidor - Error al actualizar comentario: " +
          error.message,
      });
    }
  }
);

// Elimina un comentario
app.delete(
  "/eliminar/:id",
  verifyToken,
  authorizeRole(["admin", "usuario"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const comentario = await obtenerComentarioPorId(id);
      if (comentario.length == 0)
        res.status(404).json({ mensaje: "Comentario no encontrado." });
      if (
        req.user.rol === "usuario" &&
        req.user.username !== comentario[0].email
      ) {
        return res.status(403).json({
          mensaje: "No tienes permiso para eliminar este comentario.",
        });
      } else {
        await eliminarComentario(comentario[0]._id.toString());
        res.status(200).json({ mensaje: "Comentario eliminado." });
      }
    } catch (error) {
      res.status(500).json({
        error:
          "Error interno del servidor - Error al eliminar comentario: " +
          error.message,
      });
    }
  }
);

// Elimina todos los comentarios
app.delete(
  "/eliminar",
  verifyToken,
  authorizeRole(["admin"]),
  async (req, res) => {
    try {
      const comentarios = await eliminarTodos();
      if (comentarios.deletedCount > 0) {
        res
          .status(200)
          .json({ mensaje: "Todos los comentarios fueron eliminados." });
      } else {
        res
          .status(200)
          .json({ mensaje: "No se encontraron comentarios para eliminar." });
      }
    } catch (error) {
      res.status(500).json({
        error:
          "Error interno del servidor - Error al eliminar todos los comentarios: " +
          error.message,
      });
    }
  }
);

// Inicia el servidor en el puerto 3000
app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
});
