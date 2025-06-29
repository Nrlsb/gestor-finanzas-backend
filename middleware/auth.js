const jwt = require('jsonwebtoken');

module.exports = function(req, res, next) {
    // Obtener el token del header
    const token = req.header('Authorization');

    // Chequear si no hay token
    if (!token) {
        return res.status(401).json({ msg: 'No hay token, permiso no válido' });
    }

    // El token viene como "Bearer <token>", lo separamos
    const tokenValue = token.split(' ')[1];
    if (!tokenValue) {
        return res.status(401).json({ msg: 'Formato de token no válido' });
    }

    // Verificar el token
    try {
        const decoded = jwt.verify(tokenValue, process.env.JWT_SECRET);
        // Añadimos el usuario del payload del token al objeto request
        req.user = decoded.user;
        next(); // Continuamos a la siguiente función (la ruta)
    } catch (err) {
        res.status(401).json({ msg: 'Token no es válido' });
    }
};
