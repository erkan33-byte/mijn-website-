

import random
import requests
from bitcoin import SelectParams
from bitcoin import random_key, privtopub, history

# Gebruik testnet voor deze voorbeelden
SelectParams('testnet')

def generate_btc_key():
    while True:
        private_key = random_key()
        public_key = privtopub(private_key)
        address = public_key
        print(f'Generated Address: {address}')
        
        # Controleer het saldo via een API
        response = requests.get(f'https://api.blockcypher.com/v1/btc/test3/addrs/{address}/balance')
        balance_info = response.json()
        balance = balance_info.get('final_balance', 0)

        if balance > 0:
            print(f'Address {address} has a balance of {balance} satoshi. Stopping.')
            break

generate_btc_key()


