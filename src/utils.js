var bitcoinjs = require('bitcoinjs-lib')
var BigNumber = require('bignumber.js')
var OPS = require('sbercoin-opcodes')
var Buffer = require('safe-buffer').Buffer


/**
 * This is a function for sorting SBER utxos
 *
 * @param [transaction] unspentTransactions
 * @returns [transaction]
 */

const sortUtxo = (transactions) => {
    const isMature = ({ confirmations, isStake }) =>
        confirmations > 0 && !isStake

    return [...transactions.sort((a, b) =>
        isMature(a) && isMature(b)
            ? b.value - a.value
            : isMature(a)
                ? - 1
                : isMature(b)
                    ? 1
                    : b.confirmations - a.confirmations
    )]
}

/**
 * This is a function for selecting SBER utxos to build transactions
 * the transaction object takes at least 3 fields, value(unit is 1e-8 SBER) , confirmations and isStake
 *
 * @param [transaction] unspentTransactions
 * @param Number amount(unit: SBER)
 * @param Number fee(unit: SBER)
 * @returns [transaction]
 */
function selectTxs(unspentTransactions, amount, fee) {
    unspentTransactions = sortUtxo(unspentTransactions)

    var value = new BigNumber(amount).plus(fee).times(1e7)
    var find = []
    var findTotal = new BigNumber(0)
    for (var i = 0; i < unspentTransactions.length; i++) {
        var tx = unspentTransactions[i]
        findTotal = findTotal.plus(tx.value)
        find[find.length] = tx
        if (findTotal.greaterThanOrEqualTo(value)) break
    }

    if (value.greaterThan(findTotal))
        throw new Error('You do not have enough SBER to send')

    return find
}
/**
 * This is a helper function to build a pubkeyhash transaction
 * the transaction object takes at least 5 fields, value(unit is 1e-8 SBER), confirmations, isStake, hash and pos
 *
 * @param bitcoinjs-lib.KeyPair keyPair
 * @param String to
 * @param Number amount(unit: SBER)
 * @param Number fee(unit: SBER)
 * @param [transaction] utxoList
 * @returns String the built tx
 */
function buildPubKeyHashTransaction(keyPair, to, amount, fee, utxoList) {
    var from = keyPair.getAddress()
    var inputs = selectTxs(utxoList, amount, fee)
    var tx = new bitcoinjs.TransactionBuilder(keyPair.network)
    var totalValue = new BigNumber(0)
    var value = new BigNumber(amount).times(1e7)
    var sendFee = new BigNumber(fee).times(1e7)

    for (var i = 0; i < inputs.length; i++) {
        tx.addInput(inputs[i].hash, inputs[i].pos)
        totalValue = totalValue.plus(inputs[i].value)
    }

    tx.addOutput(to, new BigNumber(value).toNumber())

    if (totalValue.minus(value).minus(sendFee).toNumber() > 0) {
        tx.addOutput(from, totalValue.minus(value).minus(sendFee).toNumber())
    }

    for (var i = 0; i < inputs.length; i++) {
        tx.sign(i, keyPair)
    }

    return tx.build().toHex()
}

/**
 * This is a helper function to build a create-contract transaction
 * the transaction object takes at least 5 fields, value(unit is 1e-8 SBER), confirmations, isStake, hash and pos
 *
 * @param bitcoinjs-lib.KeyPair keyPair
 * @param String code The contract byte code
 * @param Number gasLimit
 * @param Number gasPrice(unit: 1e-7 SBER/gas)
 * @param Number fee(unit: SBER)
 * @param [transaction] utxoList
 * @returns String the built tx
 */
function buildCreateContractTransaction(keyPair, code, gasLimit, gasPrice, fee, utxoList) {
    var from = keyPair.getAddress()
    var amount = 0
    fee = new BigNumber(gasLimit).times(gasPrice).div(1e7).add(fee).toNumber()
    var inputs = selectTxs(utxoList, amount, fee)
    var tx = new bitcoinjs.TransactionBuilder(keyPair.network)
    var totalValue = new BigNumber(0)
    var sendFee = new BigNumber(fee).times(1e7)
    for (var i = 0; i < inputs.length; i++) {
        tx.addInput(inputs[i].hash, inputs[i].pos)
        totalValue = totalValue.plus(inputs[i].value)
    }
    var contract = bitcoinjs.script.compile([
        OPS.OP_4,
        number2Buffer(gasLimit),
        (gasPrice > 16) ?
            number2Buffer(gasPrice) :
            Buffer.concat([
                number2Buffer(gasPrice),
                Buffer.from([0])
            ]),
        hex2Buffer(code),
        OPS.OP_CREATE
    ])
    tx.addOutput(contract, 0)
    if (totalValue.minus(sendFee).toNumber() > 0) {
        tx.addOutput(from, totalValue.minus(sendFee).toNumber())
    }
    for (var i = 0; i < inputs.length; i++) {
        tx.sign(i, keyPair)
    }
    return tx.build().toHex()
}

/**
 * This is a helper function to build a send-to-contract transaction
 * the transaction object takes at least 5 fields, value(unit is 1e-8 SBER), confirmations, isStake, hash and pos
 *
 * @param bitcoinjs-lib.KeyPair keyPair
 * @param String contractAddress The contract address
 * @param String encodedData The encoded abi data
 * @param Number gasLimit
 * @param Number gasPrice(unit: 1e-7 SBER/gas)
 * @param Number fee(unit: SBER)
 * @param [transaction] utxoList
 * @returns String the built tx
 */
function buildSendToContractTransaction(keyPair, contractAddress, encodedData, gasLimit, gasPrice, fee, utxoList) {
    var from = keyPair.getAddress()
    var amount = 0
    fee = new BigNumber(gasLimit).times(gasPrice).div(1e7).add(fee).toNumber()
    var inputs = selectTxs(utxoList, amount, fee)
    var tx = new bitcoinjs.TransactionBuilder(keyPair.network)
    var totalValue = new BigNumber(0)
    var sendFee = new BigNumber(fee).times(1e7)
    for (var i = 0; i < inputs.length; i++) {
        tx.addInput(inputs[i].hash, inputs[i].pos)
        totalValue = totalValue.plus(inputs[i].value)
    }
    var contract = bitcoinjs.script.compile([
        OPS.OP_4,
        number2Buffer(gasLimit),
        (gasPrice > 16) ?
            number2Buffer(gasPrice) :
            Buffer.concat([
                number2Buffer(gasPrice),
                Buffer.from([0])
            ]),
        hex2Buffer(encodedData),
        hex2Buffer(contractAddress),
        OPS.OP_CALL
    ])
    tx.addOutput(contract, 0)
    if (totalValue.minus(sendFee).toNumber() > 0) {
        tx.addOutput(from, totalValue.minus(sendFee).toNumber())
    }
    for (var i = 0; i < inputs.length; i++) {
        tx.sign(i, keyPair)
    }
    return tx.build().toHex()
}

function number2Buffer(num) {
    var buffer = []
    var neg = (num < 0)
    num = Math.abs(num)
    while (num) {
        buffer[buffer.length] = num & 0xff
        num = num >> 8
    }

    var top = buffer[buffer.length - 1]
    if (top & 0x80) {
        buffer[buffer.length] = neg ? 0x80 : 0x00
    }
    else if (neg) {
        buffer[buffer.length - 1] = top | 0x80;
    }
    return Buffer.from(buffer)
}

function hex2Buffer(hexString) {
    var buffer = []
    for (var i = 0; i < hexString.length; i += 2) {
        buffer[buffer.length] = (parseInt(hexString[i], 16) << 4) | parseInt(hexString[i + 1], 16)
    }
    return Buffer.from(buffer)
}

module.exports = {
    selectTxs: selectTxs,
    buildPubKeyHashTransaction: buildPubKeyHashTransaction,
    buildCreateContractTransaction: buildCreateContractTransaction,
    buildSendToContractTransaction: buildSendToContractTransaction,
}