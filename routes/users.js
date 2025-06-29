const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user'); // Importamos nuestro modelo de usuario

// --- RUTA DE REGISTRO ---
// @route   POST api/users/register
// @desc    Registra un nuevo usuario
// @access  Public
router.post('/register', async (req, res) => {
    // 1. Extraemos email y contraseña del cuerpo de la petición
    const { email, password } = req.body;

    try {
        // 2. Verificamos si ya existe un usuario con ese email
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ msg: 'El usuario ya existe' });
        }

        // 3. Si no existe, creamos una nueva instancia del modelo User
        user = new User({
            email,
            password
        });

        // 4. Encriptamos la contraseña antes de guardarla
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);

        // 5. Guardamos el usuario en la base de datos
        await user.save();

        // 6. Creamos un payload para el JWT (no incluimos la contraseña)
        const payload = {
            user: {
                id: user.id 
            }
        };

        // 7. Firmamos el token y lo enviamos de vuelta al cliente
        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '5h' }, // El token expira en 5 horas
            (err, token) => {
                if (err) throw err;
                res.json({ token });
            }
        );

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error del servidor');
    }
});


// --- RUTA DE LOGIN ---
// @route   POST api/users/login
// @desc    Autentica un usuario y devuelve un token
// @access  Public
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // 1. Buscamos al usuario por su email. Incluimos explícitamente la contraseña.
        let user = await User.findOne({ email }).select('+password');
        if (!user) {
            return res.status(400).json({ msg: 'Credenciales inválidas' });
        }

        // 2. Comparamos la contraseña enviada con la guardada en la base de datos
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ msg: 'Credenciales inválidas' });
        }
        
        // 3. Si todo es correcto, creamos y firmamos un nuevo token
        const payload = {
            user: {
                id: user.id
            }
        };

        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '5h' },
            (err, token) => {
                if (err) throw err;
                res.json({ token });
            }
        );

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error del servidor');
    }
});


module.exports = router;
