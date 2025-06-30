const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // NUEVO CAMPO:
    ledger: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Ledger',
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
    date: {
        type: Date,
        default: Date.now
    },
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
