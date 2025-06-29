const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
    // Asociamos la transacción con un usuario. Esta es la clave para la privacidad.
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Referencia al modelo User que ya creamos
        required: true
    },
    type: {
        type: String,
        enum: ['ingreso', 'egreso'],
        required: true
    },
    description: {
        type: String,
        trim: true,
        required: [true, 'La descripción es obligatoria']
    },
    amount: {
        type: Number,
        required: [true, 'El monto es obligatorio']
    },
    category: {
        type: String,
        required: [true, 'La categoría es obligatoria']
    },
    // Guardamos la fecha para poder ordenarlas
    date: {
        type: Date,
        default: Date.now
    },
    // Añadimos los campos que ya tenías para egresos
    originalAmount: Number,
    divisionFactor: {
        type: Number,
        default: 1
    },
    isInstallment: {
        type: Boolean,
        default: false
    },
    totalInstallments: Number,
    paidInstallments: Number
}, {
    timestamps: true
});

module.exports = mongoose.model('Transaction', TransactionSchema);
