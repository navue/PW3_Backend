// Express
const express = require("express");
const app = express();
const port = process.env.PORT || 3000;
app.use(express.json());

// Cors
const cors = require("cors");
const cors_options = {
  origin: "http://127.0.0.1:8080",
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
};
app.use(cors(cors_options));

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
connectToDatabase();

// Fecha y horario argentina
const fechaArg = {
  timeZone: "America/Argentina/Buenos_Aires",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
};

// Verificador de token
const verifyToken = (req, res, next) => {
  const token = req.headers["authorization"];
  if (!token) return res.status(403).json({ mensaje: "Token requerido." });
  jwt.verify(token.split(" ")[1], SECRET_KEY, (err, decoded) => {
    if (err) return res.status(401).json({ mensaje: "Token inválido." });

    req.user = decoded; // Guarda la info del usuario en la request
    next();
  });
};

// Verificador de roles
const authorizeRole = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.rol)) {
      return res.status(403).json({ error: "Acceso no autorizado." });
    }
    next();
  };
};

// Sanitización y validación para comentarios
const validarComentario = [
  body("apellido")
    .isString().withMessage("El apellido debe ser un texto.")
    .trim().notEmpty().withMessage("El campo apellido es obligatorio.")
    .custom(value => {
      if (!/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]+$/.test(value)) {
        throw new Error("El apellido contiene caracteres inválidos.");
      }
      return true;
    })
    .customSanitizer(value => sanitizeHtml(value)),
  body("nombre")
    .isString().withMessage("El nombre debe ser un texto.")
    .trim().notEmpty().withMessage("El campo nombre es obligatorio.")
    .custom(value => {
      if (!/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]+$/.test(value)) {
        throw new Error("El nombre contiene caracteres inválidos.");
      }
      return true;
    })
    .customSanitizer(value => sanitizeHtml(value)),
  body("asunto")
    .isString().withMessage("El asunto debe ser un texto.")
    .trim().notEmpty().withMessage("El campo asunto es obligatorio.")
    .custom(value => {
      if (!/^[a-zA-ZÁÉÍÓÚÜÑáéíóúüñ0-9\s]+$/.test(value)) {
        throw new Error("El asunto contiene caracteres inválidos.");
      }
      return true;
    })
    .customSanitizer(value => sanitizeHtml(value)),
  body("mensaje")
    .isString().withMessage("El mensaje debe ser un texto.")
    .trim().notEmpty().withMessage("El campo mensaje es obligatorio.")
    .customSanitizer(value => sanitizeHtml(value))
];

// Sanitización y validacion para registro/ingresos
const validarRegistroIngreso = [
  body("username")
    .isEmail().withMessage("Debe ingresar un email válido.")
    .normalizeEmail()
    .customSanitizer(value => sanitizeHtml(value)),
  body("password")
    .isLength({ min: 6 }).withMessage("La contraseña debe tener al menos 6 caracteres.")
    .matches(/[A-Z]/).withMessage("Debe contener al menos una letra mayúscula.")
    .matches(/[a-z]/).withMessage("Debe contener al menos una letra minúscula.")
    .matches(/[0-9]/).withMessage("Debe contener al menos un número.")
    .customSanitizer(value => sanitizeHtml(value))
];

// Limitador de registros
const registroLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // Máximo 5 acciones cada 15 minutos por IP
  message: "Demasiados intentos. Intente nuevamente en 15 minutos.",
  standardHeaders: true,
  legacyHeaders: false,
});

// Limitador de ingresos
const ingresoLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // Máximo 5 acciones cada 15 minutos por IP
  message: "Demasiados intentos. Intente nuevamente en 15 minutos.",
  standardHeaders: true,
  legacyHeaders: false,
});

// Limitador de agregado de comentarios
const agregadoLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // Máximo 10 comentarios cada 15 minutos por IP
  message: "Demasiadas solicitudes. Por favor, intente más tarde.",
  statusCode: 429
});

// Limitador de edición de comentarios
const edicionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // Máximo 10 comentarios cada 15 minutos por IP
  message: "Demasiadas solicitudes. Por favor, intente más tarde.",
  statusCode: 429
});

// Limitador de borrado de comentarios
const borradoLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // Máximo 10 comentarios cada 15 minutos por IP
  message: "Demasiadas solicitudes. Por favor, intente más tarde.",
  statusCode: 429
});

// Limitador general
const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30, // Máximo 30 acciones por minuto por IP
  message: "Demasiadas solicitudes. Espera un momento.",
  standardHeaders: true,
  legacyHeaders: false,
});

// Generación del archivo de logs
morgan.token("fecha_arg", () => {
  return new Date().toLocaleString("es-AR", fechaArg); // Formato fecha y horario argentina
});
const accessLogStream = fs.createWriteStream(
  path.join(__dirname, 'access.log'),
  { flags: 'a' }
);
const formatoApacheArg = ':remote-addr - :remote-user [:fecha_arg] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"'; // Simulo 'combined' pero con horario Arg.
app.use(morgan(formatoApacheArg, { stream: accessLogStream }));

// Ruta de registro
app.post(
  "/registro", 
  validarRegistroIngreso, 
  registroLimiter, 
  generalLimiter,
  async (req, res) => {
  const errores = validationResult(req);
  if (!errores.isEmpty()) {
    return res.status(400).json({ errores: errores.array() });
  }
  try {
    const { username, password } = req.body;
    const usuarios = await obtenerUsuarios();
    const usuarioExistente = usuarios.find(user => user.username === username);
    if (usuarioExistente) {
      return res.status(409).json({
        mensaje: "El usuario ya existe. Por favor, utilice otro email para el registro.",
      });
    }
    await registrarUsuario(username, password);
    res.status(201).json({ mensaje: "Usuario registrado." });
  } catch (error) {
    res.status(500).json({
      error: "Error interno del servidor - Error al registrar usuario: " + error.message,
    });
  }
});

// Ruta de ingreso
app.post(
  "/ingreso", 
  validarRegistroIngreso, 
  ingresoLimiter, 
  generalLimiter,
  async (req, res) => {
  const errores = validationResult(req);
  if (!errores.isEmpty()) {
    return res.status(400).json({ errores: errores.array() });
  }
  try {
    const { username, password } = req.body;
    const usuarios = await obtenerUsuarios();
    const usuarioValido = usuarios.find(
      (user) => user.username === username && user.password === password
    );
    if (usuarioValido) {
      const token = jwt.sign(
        {
          id: usuarioValido.id,
          username: usuarioValido.username,
          rol: usuarioValido.rol,
        },
        SECRET_KEY,
        { expiresIn: "1h" }
      );
      res.status(200).json({ accessToken: token });
    } else {
      res.status(401).json({ mensaje: "Credenciales incorrectas." });
    }
  } catch (error) {
    res.status(500).json({
      error: "Error interno del servidor - Error al obtener usuarios: " + error.message,
    });
  }
});

// Obtiene y muestra comentarios
app.get(
  "/comentarios",
  verifyToken,
  authorizeRole(["admin", "usuario"]),
  generalLimiter,
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
  verifyToken,
  authorizeRole(["admin", "usuario"]),
  validarComentario,
  agregadoLimiter,
  generalLimiter,
  async (req, res) => {
    const errores = validationResult(req);
    if (!errores.isEmpty()) {
      return res.status(400).json({ errores: errores.array() });
    }
    try {
      const fecha = new Date().toLocaleString("es-AR", fechaArg);
      const { apellido, nombre, asunto, mensaje } = req.body;
      const email = req.user.username;
      const resultado = await agregarComentario(
        fecha, 
        apellido, 
        nombre, 
        email, 
        asunto, 
        mensaje);
      const id = resultado.insertedId;
      res.status(201).json({
        mensaje: "Comentario agregado.",
        datos: {  id, fecha, apellido, nombre, email, asunto, mensaje },
      });
    } catch (error) {
      res.status(500).json({
        error: "Error interno del servidor - Error al agregar comentario: " + error.message,
      });
    }
  }
);

// Editar un comentario
app.put(
  "/editar/:id",
  verifyToken,
  authorizeRole(["admin", "usuario"]),
  validarComentario,
  edicionLimiter,
  generalLimiter,
  async (req, res) => {
    const errores = validationResult(req);
    if (!errores.isEmpty()) {
      return res.status(400).json({ errores: errores.array() });
    }
    try {
      const { id } = req.params;
      let { apellido, nombre, asunto, mensaje } = req.body;
      const comentario = await obtenerComentarioPorId(id);
      if (comentario.length == 0)
        return res.status(404).json({ mensaje: "Comentario no encontrado." });
      if (
        req.user.rol === "usuario" &&
        req.user.username !== comentario[0].email
      ) {
        return res
          .status(403)
          .json({ mensaje: "No tienes permiso para editar este comentario." });
      }
      const fecha = new Date().toLocaleString("es-AR", fechaArg);
      apellido = apellido || comentario[0].apellido; // Usar valor existente si no se mandó apellido
      nombre = nombre || comentario[0].nombre; // Usar valor existente si no se mandó nombre
      asunto = asunto || comentario[0].asunto; // Usar valor existente si no se mandó asunto
      mensaje = mensaje || comentario[0].mensaje; // Usar valor existente si no se mandó mensaje
      await actualizarComentario(
        comentario[0]._id.toString(), 
        fecha,
        apellido, 
        nombre, 
        asunto, 
        mensaje);
      res.status(200).json({
        mensaje: "Comentario actualizado.",
        datos: {
          id: comentario[0]._id.toString(),
          fecha,
          apellido,
          nombre,
          email: comentario[0].email,
          asunto,
          mensaje,
        },
      });
    } catch (error) {
      res.status(500).json({
        error: "Error interno del servidor - Error al actualizar comentario: " + error.message,
      });
    }
  }
);

// Elimina un comentario
app.delete(
  "/eliminar/:id",
  verifyToken,
  authorizeRole(["admin", "usuario"]),
  generalLimiter,
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
  borradoLimiter,
  generalLimiter,
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
