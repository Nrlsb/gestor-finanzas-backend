const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');

// Cargar variables de entorno del archivo .env
dotenv.config();

const app = express();

// Middleware
app.use(cors()); // Habilita CORS para todas las rutas
app.use(express.json()); // Permite al servidor aceptar y parsear JSON

// Conexión a la base de datos MongoDB
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB conectado exitosamente...');
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }
};

connectDB();

// Rutas de la API
app.use('/api/users', require('./routes/users'));
// <-- AÑADE ESTA LÍNEA para registrar las nuevas rutas de transacciones
app.use('/api/transactions', require('./routes/transactions'));


// Ruta de bienvenida para probar que el servidor está funcionando
app.get('/', (req, res) => {
    res.send('API del Gestor de Finanzas está corriendo...');
});


// Definir el puerto y arrancar el servidor
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Servidor corriendo en el puerto ${PORT}`));
