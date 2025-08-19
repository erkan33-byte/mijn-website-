const bitcoin = require('bitcoinjs-lib');
const crypto = require('crypto');
const fetch = require('node-fetch');

// Genereer een willekeurige private key
function generatePrivateKey() {
  return crypto.randomBytes(32);
}

// Private key naar public key
function privateKeyToPublicKey(privateKey) {
  const keyPair = bitcoin.ECPair.fromPrivateKey(privateKey);
  return keyPair.publicKey;
}

// Public key naar address
function publicKeyToAddress(publicKey) {
  const { address } = bitcoin.payments.p2pkh({ pubkey: publicKey });
  return address;
}

// Balans opvragen
async function checkBalance(address) {
  const url = `https://api.blockcypher.com/v1/btc/main/addrs/${address}/balance`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    return data.final_balance || 0;
  } catch {
    return 0;
  }
}

// Main functie
async function generateBtcKeyWithBalanceCheck() {
  while (true) {
    const privKey = generatePrivateKey();
    const pubKey = privateKeyToPublicKey(privKey);
    const address = publicKeyToAddress(pubKey);

    console.log('Generated Address:', address);

    const balance = await checkBalance(address);
    if (balance > 0) {
      console.log(`Address ${address} has a balance of ${balance} satoshi. Private key: ${privKey.toString('hex')}`);
      break;
    }
  }
}

generateBtcKeyWithBalanceCheck();
