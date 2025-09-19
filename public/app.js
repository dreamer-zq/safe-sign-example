/**
 * Safe Multi-Signature Manager
 * Frontend application for managing Safe multi-signature transactions
 */

// Safe contract ABI - includes only execTransaction method
const SAFE_ABI = [
    {
        "inputs": [
            {"internalType": "address", "name": "to", "type": "address"},
            {"internalType": "uint256", "name": "value", "type": "uint256"},
            {"internalType": "bytes", "name": "data", "type": "bytes"},
            {"internalType": "enum Enum.Operation", "name": "operation", "type": "uint8"},
            {"internalType": "uint256", "name": "safeTxGas", "type": "uint256"},
            {"internalType": "uint256", "name": "baseGas", "type": "uint256"},
            {"internalType": "uint256", "name": "gasPrice", "type": "uint256"},
            {"internalType": "address", "name": "gasToken", "type": "address"},
            {"internalType": "address payable", "name": "refundReceiver", "type": "address"},
            {"internalType": "bytes", "name": "signatures", "type": "bytes"}
        ],
        "name": "execTransaction",
        "outputs": [{"internalType": "bool", "name": "success", "type": "bool"}],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [
            {"internalType": "address", "name": "to", "type": "address"},
            {"internalType": "uint256", "name": "value", "type": "uint256"},
            {"internalType": "bytes", "name": "data", "type": "bytes"},
            {"internalType": "enum Enum.Operation", "name": "operation", "type": "uint8"},
            {"internalType": "uint256", "name": "safeTxGas", "type": "uint256"},
            {"internalType": "uint256", "name": "baseGas", "type": "uint256"},
            {"internalType": "uint256", "name": "gasPrice", "type": "uint256"},
            {"internalType": "address", "name": "gasToken", "type": "address"},
            {"internalType": "address", "name": "refundReceiver", "type": "address"},
            {"internalType": "uint256", "name": "_nonce", "type": "uint256"}
        ],
        "name": "getTransactionHash",
        "outputs": [{"internalType": "bytes32", "name": "", "type": "bytes32"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "nonce",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    }
];

/**
 * SafeClient class to interact with Safe transaction service
 */
class SafeClient {
    constructor(config) {
        this.config = config;
        this.baseUrl = config.txServiceUrl;
        this.safeAddress = config.safeAddress;
        this.rpcUrl = config.rpcUrl;
        this.privateKey = config.privateKey;

        // Ensure baseUrl ends with /
        if (this.baseUrl && !this.baseUrl.endsWith('/')) {
            this.baseUrl += '/';
        }
    }

    /**
     * Get Safe information
     */
    async getSafeInfo() {
        try {
            const url = `${this.baseUrl}api/v1/safes/${this.config.safeAddress}/`;
            console.log('Fetching Safe info from:', url);

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Safe info fetch failed:', {
                    status: response.status,
                    statusText: response.statusText,
                    url: url,
                    response: errorText
                });
                throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}. URL: ${url}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error fetching Safe info:', error);
            throw error;
        }
    }

    /**
     * Get pending transactions from Safe transaction service
     */
    async getPendingTransactions() {
        try {
            const url = `${this.baseUrl}api/v2/safes/${this.config.safeAddress}/multisig-transactions?executed=false`;
            console.log('Fetching pending transactions from:', url);

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Pending transactions fetch failed:', {
                    status: response.status,
                    statusText: response.statusText,
                    url: url,
                    response: errorText
                });
                throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}. URL: ${url}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error fetching pending transactions:', error);
            throw error;
        }
    }

    /**
     * Confirm a transaction by adding a signature
     */
    async confirm({ safeTxHash, privateKey }) {
        try {
            const url = `${this.baseUrl}api/v1/multisig-transactions/${safeTxHash}/confirmations/`;
            console.log('Confirming transaction at:', url);

            // Generate real signature using the private key
            let signature;
            let ownerAddress;
            let wallet;
            if (privateKey) {
                try {
                    // Create wallet instance first
                    const ethers = await this.waitForEthers();
                    const formattedPrivateKey = privateKey.startsWith('0x') ? privateKey : '0x' + privateKey;
                    
                    console.log('=== WALLET CREATION DEBUG ===');
                    console.log('Raw private key from input:', privateKey);
                    console.log('Formatted private key:', formattedPrivateKey);
                    console.log('Private key length:', formattedPrivateKey.length);
                    console.log('Expected length: 66 (including 0x)');
                    
                    wallet = new ethers.Wallet(formattedPrivateKey);
                    ownerAddress = wallet.address;
                    
                    console.log('Created wallet with address:', ownerAddress);
                    console.log('Wallet private key (first 10 chars):', wallet.privateKey.substring(0, 10) + '...');
                    
                    // Check if this address matches any of the expected Safe owners
                    const expectedOwners = [
                        '0x667Db444fd6db27eAee72C8fa49dC7D5872662a5',
                        '0x2932b7A2355D6fecc4b5c0B6BD44cC31df247a2e', 
                        '0x2191eF87E392377ec08E7c08Eb105Ef5448eCED5'
                    ];
                    
                    const isValidOwner = expectedOwners.some(owner => 
                        owner.toLowerCase() === ownerAddress.toLowerCase()
                    );
                    
                    console.log('Is valid Safe owner:', isValidOwner);
                    console.log('Expected owners:', expectedOwners);
                    console.log('==============================');
                    
                    // Generate signature using the same wallet instance
                    signature = await this.generateSignatureWithWallet(safeTxHash, wallet);
                    
                    console.log('Using real signature for transaction confirmation');
                    console.log('Owner address:', ownerAddress);
                } catch (signError) {
                    console.error('Failed to generate real signature:', signError.message);
                    throw new Error(`Failed to generate signature: ${signError.message}`);
                }
            } else {
                throw new Error('No private key provided for confirmation');
            }

            const requestBody = {
                signature: signature,
                owner: ownerAddress
            };

            console.log('=== CONFIRMATION REQUEST DEBUG ===');
            console.log('URL:', url);
            console.log('Method: POST');
            console.log('Headers:', {
                'Content-Type': 'application/json'
            });
            console.log('Request Body:', requestBody);
            console.log('Request Body JSON:', JSON.stringify(requestBody, null, 2));
            console.log('Safe Transaction Hash:', safeTxHash);
            console.log('Owner Address:', ownerAddress);
            console.log('Signature:', signature);
            console.log('Signature Length:', signature.length);
            console.log('=====================================');

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            });

            console.log('=== RESPONSE DEBUG ===');
            console.log('Response Status:', response.status);
            console.log('Response Status Text:', response.statusText);
            console.log('Response Headers:', Object.fromEntries(response.headers.entries()));
            console.log('======================');

            if (!response.ok) {
                const errorText = await response.text();
                console.error('=== TRANSACTION CONFIRMATION FAILED ===');
                console.error('Status:', response.status);
                console.error('Status Text:', response.statusText);
                console.error('URL:', url);
                console.error('Request Body:', requestBody);
                console.error('Response Text:', errorText);
                console.error('Response Headers:', Object.fromEntries(response.headers.entries()));
                
                // Try to parse error response as JSON
                try {
                    const errorJson = JSON.parse(errorText);
                    console.error('Parsed Error JSON:', errorJson);
                } catch (parseError) {
                    console.error('Could not parse error response as JSON');
                }
                console.error('=======================================');
                
                throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}. URL: ${url}`);
            }

            const data = await response.json();
            console.log('Transaction confirmation successful:', data);
            return data;
        } catch (error) {
            console.error('Error confirming transaction:', error);
            throw error;
        }
    }

    /**
     * Generate a real signature using the private key
     * Signs the transaction hash with the provided private key according to Safe standards
     */
    /**
     * Wait for ethers library to be loaded
     */
    async waitForEthers() {
        return new Promise((resolve, reject) => {
            const checkEthers = () => {
                if (typeof window.ethers !== 'undefined' && window.ethers.Wallet) {
                    resolve(window.ethers);
                } else {
                    setTimeout(checkEthers, 100);
                }
            };
            checkEthers();

            // Timeout after 30 seconds
            setTimeout(() => {
                reject(new Error('Ethers library failed to load within 30 seconds'));
            }, 30000);
        });
    }

    async generateSignature(safeTxHash, privateKey) {
        try {
            // Wait for ethers library to be loaded
            const ethers = await this.waitForEthers();

            // Ensure private key has 0x prefix
            const formattedPrivateKey = privateKey.startsWith('0x') ? privateKey : '0x' + privateKey;

            // Create wallet from private key
            const wallet = new ethers.Wallet(formattedPrivateKey);

            return await this.generateSignatureWithWallet(safeTxHash, wallet);
        } catch (error) {
            console.error('Error generating signature:', error);
            throw error;
        }
    }

    async generateSignatureWithWallet(safeTxHash, wallet) {
        try {
            // Wait for ethers library to be loaded
            const ethers = await this.waitForEthers();

            // Ensure transaction hash has 0x prefix
            const formattedTxHash = safeTxHash.startsWith('0x') ? safeTxHash : '0x' + safeTxHash;

            console.log('Signing transaction hash:', formattedTxHash);
            console.log('Using wallet address:', wallet.address);

            // For Safe signatures, we need to sign the hash directly without additional hashing
            // Use signDigest to sign the raw hash instead of signMessage which adds extra hashing
            let signature;
            
            console.log('=== SIGNATURE GENERATION DEBUG ===');
            console.log('Transaction hash to sign:', formattedTxHash);
            console.log('Wallet address before signing:', wallet.address);
            
            // Use signDigest for direct hash signing (available in ethers v6)
            if (wallet.signDigest) {
                console.log('Using signDigest method (ethers v6)');
                signature = await wallet.signDigest(formattedTxHash);
            } else if (wallet._signingKey && wallet._signingKey.signDigest) {
                // For ethers v5, access the signing key directly
                console.log('Using _signingKey.signDigest method (ethers v5)');
                signature = wallet._signingKey.signDigest(formattedTxHash);
            } else if (ethers.utils && ethers.utils.SigningKey) {
                // For ethers v5, use utils.SigningKey
                console.log('Using ethers.utils.SigningKey (ethers v5)');
                const signingKey = new ethers.utils.SigningKey(wallet.privateKey);
                signature = signingKey.signDigest(formattedTxHash);
            } else {
                // Final fallback: use signMessage but warn about potential issues
                console.log('Using signMessage fallback (may cause address mismatch)');
                console.warn('Could not find signDigest method, using signMessage which may cause signature verification issues');
                signature = await wallet.signMessage(formattedTxHash);
            }
            
            console.log('Raw signature result:', signature);
            
            // If signature is an object (ethers v5 format), convert to string
            if (typeof signature === 'object' && signature.r && signature.s && signature.v) {
                console.log('Converting signature object to string format');
                signature = ethers.utils.joinSignature(signature);
            }
            
            console.log('Final signature string:', signature);
            console.log('===================================');
            
            console.log('Generated signature:', signature);
            console.log('Signature length:', signature.length);
            
            // Verify signature format (should be 132 characters including 0x prefix)
            if (!signature.startsWith('0x') || signature.length !== 132) {
                console.warn('Signature format may be incorrect:', {
                    startsWithOx: signature.startsWith('0x'),
                    length: signature.length,
                    expected: 132
                });
            }
            
            return signature;
        } catch (error) {
            console.error('Error generating signature with wallet:', error);
            throw error;
        }
    }

    /**
     * Execute a transaction that has enough confirmations using direct contract call
     */
    async executeTransaction({ safeTxHash, privateKey }) {
        try {
            console.log('Starting transaction execution:', safeTxHash);

        // Get transaction details
            const url = `${this.baseUrl}api/v1/multisig-transactions/${safeTxHash}/`;
            const txResponse = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!txResponse.ok) {
                throw new Error(`Failed to get transaction details: ${txResponse.status}`);
            }

            const txData = await txResponse.json();
            console.log('Transaction details:', txData);

            // Check if confirmations meet threshold
            const confirmationsRequired = txData.confirmationsRequired || 1;
            const confirmationsCount = txData.confirmations ? txData.confirmations.length : 0;
            
            if (confirmationsCount < confirmationsRequired) {
                throw new Error(`Insufficient confirmations: ${confirmationsCount}/${confirmationsRequired}`);
            }

            if (txData.isExecuted) {
                throw new Error('Transaction already executed');
            }

            // Use configured RPC provider and private key
            if (!this.rpcUrl) {
                throw new Error('RPC URL not configured');
            }
            
            if (!privateKey && !this.privateKey) {
                throw new Error('Private key not configured');
            }

            const provider = new ethers.providers.JsonRpcProvider(this.rpcUrl);
            const wallet = new ethers.Wallet(privateKey || this.privateKey, provider);
            
            // Create Safe contract instance
            const safeContract = new ethers.Contract(this.safeAddress, SAFE_ABI, wallet);
            
            // Prepare execTransaction parameters
            const to = txData.to;
            const value = txData.value || '0';
            const data = txData.data || '0x';
            const operation = txData.operation || 0; // 0 = Call, 1 = DelegateCall
            const safeTxGas = txData.safeTxGas || '0';
            const baseGas = txData.baseGas || '0';
            const gasPrice = txData.gasPrice || '0';
            const gasToken = txData.gasToken || '0x0000000000000000000000000000000000000000';
            const refundReceiver = txData.refundReceiver || '0x0000000000000000000000000000000000000000';
            
            // Get current nonce
            const nonce = await safeContract.nonce();
            console.log('Current Safe nonce:', nonce.toString());
            
            // Calculate transaction hash
            const txHash = await safeContract.getTransactionHash(
                to,
                value,
                data,
                operation,
                safeTxGas,
                baseGas,
                gasPrice,
                gasToken,
                refundReceiver,
                nonce
            );
            console.log('Calculated transaction hash:', txHash);
            
            // Build correct signature data
            const confirmations = txData.confirmations || [];
            const validConfirmations = confirmations.filter(c => c.signature && c.owner);
            
            // Sort by owner address
            validConfirmations.sort((a, b) => a.owner.toLowerCase().localeCompare(b.owner.toLowerCase()));
            
            let signatures = '0x';
            for (const confirmation of validConfirmations) {
                // Ensure signature format is correct (65 bytes)
                let sig = confirmation.signature;
                if (sig.startsWith('0x')) {
                    sig = sig.slice(2);
                }
                
                // Safe contract requires signature format: r(32) + s(32) + v(1)
                if (sig.length === 130) { // 65 bytes * 2 (hex)
                    signatures += sig;
                } else {
                    console.warn('Skipping invalid signature length:', sig.length, 'for owner:', confirmation.owner);
                }
            }
            
            console.log('Execution parameters:', {
                to,
                value,
                data,
                operation,
                safeTxGas,
                baseGas,
                gasPrice,
                gasToken,
                refundReceiver,
                nonce: nonce.toString(),
                signatures,
                validConfirmationsCount: validConfirmations.length
            });
            
            // Try to estimate gas first
            let gasLimit;
            try {
                gasLimit = await safeContract.estimateGas.execTransaction(
                    to,
                    value,
                    data,
                    operation,
                    safeTxGas,
                    baseGas,
                    gasPrice,
                    gasToken,
                    refundReceiver,
                    signatures
                );
                console.log('Estimated gas limit:', gasLimit.toString());
                // Add 20% buffer
                gasLimit = gasLimit.mul(120).div(100);
            } catch (gasError) {
                console.warn('Gas estimation failed, using default value:', gasError.message);
                // Use larger default gas limit
                gasLimit = ethers.BigNumber.from('500000');
            }
            
            // Execute transaction
            const tx = await safeContract.execTransaction(
                to,
                value,
                data,
                operation,
                safeTxGas,
                baseGas,
                gasPrice,
                gasToken,
                refundReceiver,
                signatures,
                {
                    gasLimit: gasLimit
                }
            );
            
            console.log('Transaction submitted:', tx.hash);
            
            // Wait for transaction confirmation
            const receipt = await tx.wait();
            console.log('Transaction confirmed:', receipt);
            
            return {
                success: true,
                transactionHash: tx.hash,
                blockNumber: receipt.blockNumber
            };
            
        } catch (error) {
            console.error('Transaction execution failed:', error);
            throw error;
        }
    }

    /**
     * Test connection to the Safe transaction service
     */
    async testConnection() {
        try {
            // Try to fetch the service info first
            const serviceUrl = `${this.baseUrl}api/v1/about/`;
            console.log('Testing connection to:', serviceUrl);

            const response = await fetch(serviceUrl, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                throw new Error(`Service not available: ${response.status} - ${response.statusText}`);
            }

            const serviceInfo = await response.json();
            console.log('Service info:', serviceInfo);
            return serviceInfo;
        } catch (error) {
            console.error('Connection test failed:', error);
            throw error;
        }
    }
}

// Global state management
class SafeManager {
    constructor() {
        this.safeClient = null;
        this.config = {
            txServiceUrl: 'https://safe-transaction-mainnet.safe.global',
            rpcUrl: '',
            privateKey: '',
            safeAddress: ''
        };
        this.isConnected = false;
        this.pendingTransactions = [];
        this.refreshInterval = null;

        this.initializeApp();
    }

    /**
     * Initialize the application
     */
    initializeApp() {
        this.bindEventListeners();
        this.loadConfiguration();
        // Application initialized
    }

    setNetworkPreset(network) {
        const presets = {
            mainnet: {
                txServiceUrl: 'https://safe-transaction-mainnet.safe.global/',
                rpcUrl: 'https://mainnet.infura.io/v3/YOUR_PROJECT_ID'
            },
            polygon: {
                txServiceUrl: 'https://safe-transaction-polygon.safe.global/',
                rpcUrl: 'https://polygon-mainnet.infura.io/v3/YOUR_PROJECT_ID'
            },
            arbitrum: {
                txServiceUrl: 'https://safe-transaction-arbitrum.safe.global/',
                rpcUrl: 'https://arbitrum-mainnet.infura.io/v3/YOUR_PROJECT_ID'
            },
            optimism: {
                txServiceUrl: 'https://safe-transaction-optimism.safe.global/',
                rpcUrl: 'https://optimism-mainnet.infura.io/v3/YOUR_PROJECT_ID'
            },
            sepolia: {
                txServiceUrl: 'https://safe-transaction-sepolia.safe.global/',
                rpcUrl: 'https://sepolia.infura.io/v3/YOUR_PROJECT_ID'
            },
            local: {
                txServiceUrl: 'http://localhost:8000/api/',
                rpcUrl: 'http://localhost:8545'
            }
        };

        if (presets[network]) {
            document.getElementById('txServiceUrl').value = presets[network].txServiceUrl;
            document.getElementById('rpcUrl').value = presets[network].rpcUrl;
            // Set network preset
        }
    }

    bindEventListeners() {
        document.getElementById('connectSafe').addEventListener('click', () => this.connectToSafe());
        document.getElementById('saveConfig').addEventListener('click', () => this.saveConfiguration());
        document.getElementById('loadConfig').addEventListener('click', () => this.loadConfiguration());
        document.getElementById('refreshTransactions').addEventListener('click', () => this.refreshPendingTransactions());
    }

    saveConfiguration() {
        try {
            const config = {
                txServiceUrl: document.getElementById('txServiceUrl').value,
                rpcUrl: document.getElementById('rpcUrl').value,
                safeAddress: document.getElementById('safeAddress').value,
                // Note: Private key is not saved for security reasons
            };
            
            localStorage.setItem('safeManagerConfig', JSON.stringify(config));
            // Configuration saved successfully (private key excluded for security)
        } catch (error) {
            // Failed to save configuration
        }
    }

    loadConfiguration() {
        try {
            const savedConfig = localStorage.getItem('safeManagerConfig');
            if (savedConfig) {
                const config = JSON.parse(savedConfig);
                document.getElementById('txServiceUrl').value = config.txServiceUrl || '';
                document.getElementById('rpcUrl').value = config.rpcUrl || '';
                document.getElementById('safeAddress').value = config.safeAddress || '';
                // Configuration loaded successfully (private key must be entered manually)
            } else {
                // No saved configuration found
            }
        } catch (error) {
            // Failed to load configuration
        }
    }

    async connectToSafe() {
        try {
            if (!this.validateConfiguration()) {
                return;
            }

            this.showLoading(true);
            // Creating Safe client...

            const config = {
                txServiceUrl: document.getElementById('txServiceUrl').value,
                rpcUrl: document.getElementById('rpcUrl').value,
                privateKey: document.getElementById('privateKey').value,
                safeAddress: document.getElementById('safeAddress').value
            };

            this.safeClient = new SafeClient(config);

            // Testing connection to Safe transaction service...
            try {
                await this.safeClient.testConnection();
                // Safe transaction service is available
            } catch (error) {
                // Service connection failed
                // Trying to fetch Safe info directly...
            }

            // Fetching Safe information...
            const safeInfo = await this.safeClient.getSafeInfo();
            
            if (safeInfo) {
                this.updateSafeStatus(safeInfo);
                this.updateConnectionStatus('Connected');
                // Successfully connected to Safe
                
                // Start auto-refresh
                this.startAutoRefresh();
                
                // Fetch initial transactions
                await this.refreshPendingTransactions();
                
                // Update signer balance
                await this.updateSignerBalance();
            } else {
                this.updateConnectionStatus('Failed');
                // Connection failed - could not retrieve Safe information
            }
        } catch (error) {
            this.updateConnectionStatus('Failed');
            const errorMessage = error.message || 'Unknown error occurred';
            // Connection failed
        } finally {
            this.showLoading(false);
        }
    }

    validateConfiguration() {
        const rpcUrl = document.getElementById('rpcUrl').value;
        if (!rpcUrl) {
            // RPC URL is required
            return false;
        }

        const privateKey = document.getElementById('privateKey').value;
        if (!privateKey || privateKey.length < 64) {
            // Valid private key is required
            return false;
        }

        const safeAddress = document.getElementById('safeAddress').value;
        if (!safeAddress || !safeAddress.startsWith('0x')) {
            // Valid Safe address is required
            return false;
        }

        return true;
    }

    updateSafeStatus(safeInfo = null) {
        const safeAddress = document.getElementById('safeAddress').value;
        const privateKey = document.getElementById('privateKey').value;
        
        document.getElementById('currentSafeAddress').textContent = safeAddress || 'Not connected';
        document.getElementById('isDeployed').textContent = safeInfo ? 'Yes' : 'Unknown';
        
        if (privateKey) {
            const signerAddress = this.getSignerAddressFromPrivateKey(privateKey);
            document.getElementById('signerAddress').textContent = signerAddress;
        } else {
            document.getElementById('signerAddress').textContent = 'Not connected';
        }
    }

    getSignerAddressFromPrivateKey(privateKey) {
        try {
            const formattedPrivateKey = privateKey.startsWith('0x') ? privateKey : '0x' + privateKey;
            const wallet = new ethers.Wallet(formattedPrivateKey);
            return wallet.address;
        } catch (error) {
            return 'Invalid private key';
        }
    }

    updateConnectionStatus(status) {
        const statusElement = document.getElementById('connectionStatus');
        statusElement.textContent = status;
        
        // Update status styling
        statusElement.className = 'status-value';
        if (status === 'Connected') {
            statusElement.classList.add('status-connected');
        } else if (status === 'Failed') {
            statusElement.classList.add('status-failed');
        }
    }

    /**
     * Update signer balance display
     */
    async updateSignerBalance() {
        try {
            const privateKey = document.getElementById('privateKey').value;
            const rpcUrl = document.getElementById('rpcUrl').value;
            
            if (!privateKey || !rpcUrl) {
                document.getElementById('signerBalance').textContent = '0 ETH';
                return;
            }

            const ethers = await this.safeClient.waitForEthers();
            const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
            const formattedPrivateKey = privateKey.startsWith('0x') ? privateKey : '0x' + privateKey;
            const wallet = new ethers.Wallet(formattedPrivateKey, provider);
            
            const balance = await provider.getBalance(wallet.address);
            const balanceInEth = ethers.utils.formatEther(balance);
            
            document.getElementById('signerBalance').textContent = `${parseFloat(balanceInEth).toFixed(4)} ETH`;
        } catch (error) {
            document.getElementById('signerBalance').textContent = 'Error loading balance';
        }
    }

    startAutoRefresh() {
        // Clear any existing interval
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }

        // Set up new interval for auto-refresh every 30 seconds
        this.refreshInterval = setInterval(() => {
            this.refreshPendingTransactions();
            this.updateSignerBalance();
        }, 30000);
    }

    async refreshPendingTransactions() {
        try {
            if (!this.safeClient) {
                // Not connected to Safe
                return;
            }

            // Fetching pending transactions from Safe service...
            const transactions = await this.safeClient.getPendingTransactions();
            
            if (Array.isArray(transactions)) {
                this.pendingTransactions = transactions.filter(tx => {
                    return tx && tx.safeTxHash && !tx.isExecuted;
                });
            } else if (transactions && transactions.results) {
                this.pendingTransactions = transactions.results.filter(tx => {
                    return tx && tx.safeTxHash && !tx.isExecuted;
                });
            } else {
                // Unexpected response format from Safe service
                this.pendingTransactions = [];
            }

            this.renderPendingTransactions();
            console.log(`Found ${this.pendingTransactions.length} pending transactions`);
        } catch (error) {
            console.error('Failed to refresh transactions:', error);
            this.pendingTransactions = [];
            this.renderPendingTransactions();
        }
    }



    /**
     * Render pending transactions in the UI
     */
    renderPendingTransactions() {
        const container = document.getElementById('transactionsContainer');

        if (!container) {
            console.error('Transactions container not found');
            return;
        }

        // Ensure pendingTransactions is an array
        if (!Array.isArray(this.pendingTransactions)) {
            console.warn('pendingTransactions is not an array:', this.pendingTransactions);
            this.pendingTransactions = [];
        }

        if (this.pendingTransactions.length === 0) {
            container.innerHTML = `
                <div class="no-transactions">
                    <div class="no-transactions-icon">📋</div>
                    <h3>No Pending Transactions</h3>
                    <p>Current Safe wallet has no transactions to confirm</p>
                    <p class="text-muted">New multi-signature transactions will appear here</p>
                </div>
            `;
            return;
        }

        try {
            // Filter out any invalid transactions before rendering
            const validTransactions = this.pendingTransactions.filter(tx => {
                return tx && typeof tx === 'object' && tx.safeTxHash;
            });

            if (validTransactions.length === 0) {
                container.innerHTML = `
                    <div class="no-transactions">
                        <div class="no-transactions-icon">⚠️</div>
                    <h3>No Valid Transactions</h3>
                    <p>Retrieved transaction data is invalid or corrupted</p>
                    </div>
                `;
                return;
            }

            // Limit to 3 transactions for display, but keep all for scrolling
            const transactionsToRender = validTransactions;
            
            container.innerHTML = transactionsToRender.map(tx => {
                try {
                    return this.renderTransactionCard(tx);
                } catch (error) {
                    console.error('Error rendering transaction card:', error, tx);
                    return `
                        <div class="transaction-card fade-in">
                            <div class="transaction-header">
                                <div class="transaction-hash">Error rendering transaction</div>
                                <div class="transaction-status status-error">Error</div>
                            </div>
                        </div>
                    `;
                }
            }).join('');
        } catch (error) {
            console.error('Error rendering transactions:', error);
            container.innerHTML = `
                <div class="no-transactions">
                    <div class="no-transactions-icon">❌</div>
                    <h3>Error Displaying Transactions</h3>
                    <p>Please refresh the page and try again</p>
                </div>
            `;
        }
    }

    /**
     * Render a single transaction card
     */
    renderTransactionCard(transaction) {
        // Add null checks for required fields
        if (!transaction || !transaction.safeTxHash) {
            console.warn('Invalid transaction data:', transaction);
            return `
                <div class="transaction-card fade-in">
                    <div class="transaction-header">
                        <div class="transaction-hash">Invalid Transaction</div>
                        <div class="transaction-status status-error">Error</div>
                    </div>
                    <div class="transaction-details">
                        <div class="detail-item">
                            <div class="detail-label">Error</div>
                            <div class="detail-value">Transaction data is incomplete</div>
                        </div>
                    </div>
                </div>
            `;
        }

        // Safely handle confirmations array
        const confirmations = transaction.confirmations || [];
        const confirmationsRequired = transaction.confirmationsRequired || 1;
        const isConfirmed = confirmations.length >= confirmationsRequired;
        const canConfirm = !isConfirmed && !transaction.isExecuted;
        const canExecute = isConfirmed && !transaction.isExecuted;

        // Safely handle safeTxHash
        const safeTxHashDisplay = transaction.safeTxHash ?
            `${transaction.safeTxHash.slice(0, 10)}...${transaction.safeTxHash.slice(-8)}` :
            'Unknown Hash';

        return `
            <div class="transaction-card fade-in">
                <div class="transaction-header">
                    <div class="transaction-hash">${safeTxHashDisplay}</div>
                    <div class="transaction-status ${transaction.isExecuted ? 'status-executed' : (isConfirmed ? 'status-confirmed' : 'status-pending')}">
                        ${transaction.isExecuted ? 'Executed' : (isConfirmed ? 'Ready to Execute' : 'Pending')}
                    </div>
                </div>
                
                <div class="transaction-details">
                    <div class="detail-item">
                        <div class="detail-label">To Address</div>
                        <div class="detail-value">${transaction.to || 'Unknown'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Value (ETH)</div>
                        <div class="detail-value">${transaction.value ? (parseInt(transaction.value) / 1e18).toFixed(4) : '0.0000'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Gas Limit</div>
                        <div class="detail-value">${transaction.safeTxGas || 'Unknown'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Confirmations</div>
                        <div class="detail-value">${confirmations.length}/${confirmationsRequired}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Submitted</div>
                        <div class="detail-value">${transaction.submissionDate ? new Date(transaction.submissionDate).toLocaleString() : 'Unknown'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Data</div>
                        <div class="detail-value">${transaction.data ? (transaction.data.slice(0, 20) + (transaction.data.length > 20 ? '...' : '')) : 'No data'}</div>
                    </div>
                </div>
                
                <div class="transaction-actions">
                    ${canConfirm && transaction.safeTxHash ? `
                        <button class="btn btn-success" onclick="safeManager.confirmTransaction('${transaction.safeTxHash}')">
                            Confirm Transaction
                        </button>
                    ` : ''}
                    ${canExecute && transaction.safeTxHash ? `
                        <button class="btn btn-execute" onclick="safeManager.executeTransaction('${transaction.safeTxHash}')">
                            Execute Transaction
                        </button>
                    ` : ''}
                    ${transaction.safeTxHash ? `
                        <button class="btn btn-secondary" onclick="safeManager.viewTransactionDetails('${transaction.safeTxHash}')">
                            View Details
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    /**
     * Confirm a transaction
     */
    async confirmTransaction(safeTxHash) {
        if (!this.safeClient) {
            // Not connected to Safe
            return;
        }

        const privateKey = document.getElementById('privateKey').value;
        if (!privateKey) {
            // Private key not configured. Please enter your private key in the configuration.
            return;
        }

        try {
            // Confirming transaction...
            console.log('Confirming transaction:', safeTxHash);

            const result = await this.safeClient.confirm({ 
                safeTxHash: safeTxHash, 
                privateKey: privateKey 
            });
            
            if (result) {
                // Transaction confirmed successfully
                console.log('Transaction confirmed successfully:', result);
                await this.refreshPendingTransactions();
                return true;
            } else {
                // Failed to confirm transaction
                console.log('Failed to confirm transaction - no result');
                return false;
            }
        } catch (error) {
            console.error('Failed to confirm transaction:', error);
            
            // Extract meaningful error message
            let errorMessage = 'Failed to confirm transaction';
            if (error.message) {
                if (error.message.includes('HTTP error! status: 400')) {
                    errorMessage = 'Invalid request - check transaction hash and private key';
                } else if (error.message.includes('HTTP error! status: 404')) {
                    errorMessage = 'Transaction not found';
                } else if (error.message.includes('HTTP error! status: 500')) {
                    errorMessage = 'Server error - please try again later';
                } else if (error.message.includes('Failed to generate signature')) {
                    errorMessage = 'Invalid private key or signature generation failed';
                } else if (error.message.includes('No private key provided')) {
                    errorMessage = 'Private key is required for confirmation';
                } else {
                    errorMessage = error.message;
                }
            }
            
            // Show simplified error message at bottom of page
            showError(errorMessage);
            return false;
        }
    }

    async checkAndExecuteTransaction(transaction) {
        try {
            const confirmationsCount = transaction.confirmations ? transaction.confirmations.length : 0;
            const confirmationsRequired = transaction.confirmationsRequired || 1;
            
            // Transaction confirmations status
            
            if (confirmationsCount >= confirmationsRequired && !transaction.isExecuted) {
                // Transaction has reached threshold, executing automatically...
                await this.executeTransaction(transaction.safeTxHash);
            } else if (transaction.isExecuted) {
                // Transaction is already executed
            } else {
                // Transaction needs more confirmations
            }
        } catch (error) {
            // Could not check transaction for auto-execution
        }
    }

    async executeTransaction(safeTxHash) {
        try {
            console.log('Starting transaction execution:', safeTxHash);
            
            // Get private key from input
            const privateKey = document.getElementById('privateKey').value;
            if (!privateKey) {
                showError('Private key is required to execute transaction');
                return;
            }
            
            const result = await this.safeClient.executeTransaction({ safeTxHash, privateKey });
            
            if (result && result.success) {
                showError('Transaction executed successfully!', 'success');
                await this.refreshPendingTransactions();
            } else {
                showError('Transaction execution failed');
            }
        } catch (error) {
            console.error('Error executing transaction:', error);
            showError('Error executing transaction: ' + error.message);
        }
    }

    async executeTransactionDirect(safeTxHash) {
        const privateKey = document.getElementById('privateKey').value;
        if (!privateKey) {
            // Private key is required to execute transaction
            return;
        }

        try {
            const result = await this.safeClient.executeTransaction(safeTxHash);
            
            if (result && result.success) {
                await this.refreshPendingTransactions();
            }
        } catch (error) {
            // Failed to execute transaction
        }
    }

    viewTransactionDetails(safeTxHash) {
        const transaction = this.pendingTransactions.find(tx => tx.safeTxHash === safeTxHash);
        
        if (!transaction) {
            // Transaction not found
            return;
        }

        // Viewing details for transaction...
        
        // Create and show modal with transaction details
        this.showTransactionModal(transaction);
    }

    /**
     * View transaction details in a modal
     */
    viewTransactionDetails(safeTxHash) {
        const transaction = this.pendingTransactions.find(tx => tx.safeTxHash === safeTxHash);
        if (!transaction) {
            this.addLog(`Transaction not found: ${safeTxHash}`, 'error');
            return;
        }

        this.addLog(`Viewing details for transaction: ${safeTxHash.slice(0, 10)}...`);

        // Populate modal content
        const modalContent = document.getElementById('transactionDetailsContent');
        const confirmations = transaction.confirmations || [];
        const confirmationsRequired = transaction.confirmationsRequired || 0;

        modalContent.innerHTML = `
            <div class="transaction-detail-item">
                <span class="transaction-detail-label">Transaction Hash:</span>
                <span class="transaction-detail-value hash">${safeTxHash}</span>
            </div>
            <div class="transaction-detail-item">
                <span class="transaction-detail-label">To Address:</span>
                <span class="transaction-detail-value hash">${transaction.to || 'N/A'}</span>
            </div>
            <div class="transaction-detail-item">
                <span class="transaction-detail-label">Value:</span>
                <span class="transaction-detail-value">${transaction.value || '0'} ETH</span>
            </div>
            <div class="transaction-detail-item">
                <span class="transaction-detail-label">Data:</span>
                <span class="transaction-detail-value hash">${transaction.data || '0x'}</span>
            </div>
            <div class="transaction-detail-item">
                <span class="transaction-detail-label">Nonce:</span>
                <span class="transaction-detail-value">${transaction.nonce || 'N/A'}</span>
            </div>
            <div class="transaction-detail-item">
                <span class="transaction-detail-label">Gas Price:</span>
                <span class="transaction-detail-value">${transaction.gasPrice || 'N/A'}</span>
            </div>
            <div class="transaction-detail-item">
                <span class="transaction-detail-label">Gas Limit:</span>
                <span class="transaction-detail-value">${transaction.gasLimit || transaction.gas || 'N/A'}</span>
            </div>
            <div class="transaction-detail-item">
                <span class="transaction-detail-label">Confirmations:</span>
                <span class="transaction-detail-value">${confirmations.length}/${confirmationsRequired}</span>
            </div>
            <div class="transaction-detail-item">
                <span class="transaction-detail-label">Submission Date:</span>
                <span class="transaction-detail-value">${transaction.submissionDate ? new Date(transaction.submissionDate).toLocaleString() : 'N/A'}</span>
            </div>
            <div class="transaction-detail-item">
                <span class="transaction-detail-label">Modified Date:</span>
                <span class="transaction-detail-value">${transaction.modified ? new Date(transaction.modified).toLocaleString() : 'N/A'}</span>
            </div>
            <div class="transaction-detail-item">
                <span class="transaction-detail-label">Confirmation Status:</span>
                <div class="transaction-detail-value">
                    <div style="margin-bottom: 8px;">
                        <strong>Progress: ${confirmations.length}/${confirmationsRequired} confirmations</strong>
                    </div>
                    ${confirmations.length > 0 ? confirmations.map(conf => `
                        <div class="confirmation-item">
                            <span class="confirmation-address">${conf.owner || 'Unknown'}</span>
                            <span class="confirmation-status confirmed">Confirmed</span>
                        </div>
                    `).join('') : ''}
                    ${confirmationsRequired > confirmations.length ? `
                        <div class="confirmation-item">
                            <span class="confirmation-address">Remaining signatures needed</span>
                            <span class="confirmation-status pending">${confirmationsRequired - confirmations.length} pending</span>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;

        // Show modal
        const modal = document.getElementById('transactionModal');
        modal.classList.remove('hidden');

        // Add click outside to close
        modal.onclick = (e) => {
            if (e.target === modal) {
                this.closeTransactionModal();
            }
        };
    }

    /**
     * Close transaction details modal
     */
    closeTransactionModal() {
        const modal = document.getElementById('transactionModal');
        modal.classList.add('hidden');
        modal.onclick = null;
    }



    /**
     * Show/hide loading overlay
     */
    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        if (show) {
            overlay.classList.remove('hidden');
        } else {
            overlay.classList.add('hidden');
        }
    }



    /**
     * Cleanup when page is unloaded
     */
    cleanup() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.safeManager = new SafeManager();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.safeManager) {
        window.safeManager.cleanup();
    }
});

// Error display functions
function showError(message) {
    const errorDisplay = document.getElementById('errorDisplay');
    const errorMessage = document.getElementById('errorMessage');
    
    if (errorDisplay && errorMessage) {
        errorMessage.textContent = message;
        errorDisplay.classList.remove('hidden');
        
        // Auto-hide after 10 seconds
        setTimeout(() => {
            hideError();
        }, 10000);
    }
}

function hideError() {
    const errorDisplay = document.getElementById('errorDisplay');
    if (errorDisplay) {
        errorDisplay.classList.add('hidden');
    }
}

// Make functions globally available
window.showError = showError;
window.hideError = hideError;