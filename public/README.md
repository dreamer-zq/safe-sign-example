# Safe Multi-Signature Management Interface

This is a local web interface for managing Safe multi-signature wallets.

## Features

- Real-time retrieval of pending transaction information
- Support for multi-signature participant confirmation and signing
- Configurable network and wallet settings
- Clean and intuitive user interface

## Usage

1. Start the local server:
   ```bash
   npm run start
   ```

2. Open in browser:
   ```
   http://localhost:8080
   ```

3. Configure the necessary parameters:
   - **Safe Address**: Your Safe multi-signature wallet address
   - **RPC URL**: Blockchain network RPC endpoint
   - **Private Key**: Your private key (for signing)
   - **Transaction Service URL**: Safe transaction service URL

4. Click the "Connect Safe" button to establish connection

5. View the pending transaction list and click "Confirm Signature" button to sign

## Security Notes

- Please ensure you use this application in a secure environment
- Private key information is stored locally only and is not sent to any server
- It is recommended to test on a test network first

## Tech Stack

- Pure HTML/CSS/JavaScript
- Safe SDK
- Viem library for Ethereum interaction