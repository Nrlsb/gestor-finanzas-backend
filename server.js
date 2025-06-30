const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

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
app.use('/api/transactions', require('./routes/transactions'));
// --- LÍNEA AÑADIDA ---
app.use('/api/ledgers', require('./routes/ledgers')); 

app.get('/', (req, res) => {
    res.send('API del Gestor de Finanzas está corriendo...');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Servidor corriendo en el puerto ${PORT}`));
