var sbercoinjs = require('bitcoinjs-lib')

Object.assign(sbercoinjs.networks, require('./networks'))

sbercoinjs.utils = require('./utils')

module.exports = sbercoinjs