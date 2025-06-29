const mongoose = require('mongoose');

// Un Schema define la estructura de los documentos dentro de una colección en MongoDB.
const UserSchema = new mongoose.Schema({
    email: {
        type: String,
        required: [true, 'Por favor, provea un email'],
        unique: true, // Cada email debe ser único
        match: [
            /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
            'Por favor, provea un email válido'
        ]
    },
    password: {
        type: String,
        required: [true, 'Por favor, provea una contraseña'],
        minlength: 6, // La contraseña debe tener al menos 6 caracteres
        select: false // No se incluirá la contraseña en las consultas por defecto
    },
    // Podríamos añadir más campos como 'nombre', 'moneda', etc. en el futuro.
}, {
    timestamps: true // Añade automáticamente los campos createdAt y updatedAt
});

// Exportamos el modelo para poder usarlo en otras partes de la aplicación.
module.exports = mongoose.model('User', UserSchema);
