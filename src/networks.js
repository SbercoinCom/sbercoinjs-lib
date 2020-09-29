module.exports = {
    sbercoin: {
        messagePrefix: '\x15SBER Signed Message:\n',
        bech32: 'sber',
        bip32: {
            public: 0x0488b21e,
            private: 0x0488ade4
        },
        pubKeyHash: 0x3f,
        scriptHash: 0x1a,
        wif: 0x3c
    },
    sbercoin_testnet: {
        messagePrefix: '\x15SBER Signed Message:\n',
        bech32: 'tb',
        bip32: {
            public: 0x043587cf,
            private: 0x04358394
        },
        pubKeyHash: 0x55,
        scriptHash: 0x6e,
        wif: 0xef
    }
}
