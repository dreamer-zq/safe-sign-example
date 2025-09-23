/**
 * Safe Multi-Signature Manager - TypeScript Version
 * Frontend application for managing Safe multi-signature transactions with Safe SDK
 */

// TypeScript type definitions
interface SafeConfig {
    safeAddress: string;
    rpcUrl: string;
    chainId: number;
    txServiceUrl: string;
    privateKey: string;
}

interface SafeInfo {
    address: string;
    nonce: number;
    threshold: number;
    owners: string[];
    modules: string[];
    fallbackHandler: string;
    guard: string;
    version: string;
}

interface PendingTransaction {
    safe: string;
    to: string;
    value: string;
    data: string;
    operation: number;
    gasToken: string;
    safeTxGas: number;
    baseGas: number;
    gasPrice: string;
    refundReceiver: string;
    nonce: number;
    executionDate: string | null;
    submissionDate: string;
    modified: string;
    blockNumber: number | null;
    transactionHash: string | null;
    safeTxHash: string;
    proposer: string;
    executor: string | null;
    isExecuted: boolean;
    isSuccessful: boolean | null;
    ethGasPrice: string | null;
    maxFeePerGas: string | null;
    maxPriorityFeePerGas: string | null;
    gasUsed: number | null;
    fee: string | null;
    origin: string;
    dataDecoded: any | null;
    confirmationsRequired: number;
    confirmations: Array<{
        owner: string;
        submissionDate: string;
        transactionHash: string | null;
        signature: string;
        signatureType: string;
    }>;
    trusted: boolean;
    signatures: string | null;
}

// Safe SDK imports
import { createSafeClient, SafeClient } from '@safe-global/sdk-starter-kit';
import Safe, { 
    SafeAccountConfig, 
    SafeDeploymentConfig, 
    PredictedSafeProps 
} from '@safe-global/protocol-kit';
// Viem imports for address generation and function encoding
import { privateKeyToAddress } from 'viem/accounts';
import { encodeFunctionData, parseAbi, isAddress } from 'viem';
import { waitForTransactionReceipt } from 'viem/actions';

// Declare global ethers from CDN
declare global {
    interface Window {
        ethers: any;
        showError: (message: string, type?: string) => void;
        hideError: () => void;
        hideSuccess: () => void;
        showSuccess: (message: string) => void;
        safeManager: SafeManager;
    }
}

/**
 * SafeManager class to manage Safe operations using Safe SDK
 */
class SafeManager {
    private config: SafeConfig | null = null;
    private safeClient: SafeClient | null = null;
    private safeInfo: SafeInfo | null = null;
    private refreshInterval: NodeJS.Timeout | null = null;
    private countdownInterval: NodeJS.Timeout | null = null;
    private countdownSeconds: number = 10;
    private pendingTransactions: PendingTransaction[] = [];

    constructor() {
        this.loadConfiguration();
        this.bindEventListeners();
    }

    /**
     * Initialize Safe SDK client
     */
    async initializeSafeClient(): Promise<any> {
        try {
            if (!this.config) {
                throw new Error('Configuration not loaded');
            }

            // If no Safe address is provided, we'll use fallback API calls
            if (!this.config.safeAddress || this.config.safeAddress.trim() === '') {
                return null;
            }
            
            const safeClient = await createSafeClient({
                provider: this.config.rpcUrl,
                signer: this.config.privateKey,
                safeAddress: this.config.safeAddress,
                txServiceUrl: this.config.txServiceUrl
            });

            return safeClient;
        } catch (error) {
            return null;
        }
    }

    /**
     * Initialize the application
     */
    async initializeApp(): Promise<void> {
        try {
            // Only try to connect if we have a valid configuration
            if (this.config) {
                this.safeClient = await this.initializeSafeClient();
                await this.connectToSafe();
            } else {
                this.updateConnectionStatus('Not configured');
            }
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showError('Failed to initialize application');
        }
    }

    /**
     * Bind event listeners for UI interactions
     */
    bindEventListeners(): void {
        const saveBtn = document.getElementById('saveConfig');
        const loadBtn = document.getElementById('loadConfig');
        const connectBtn = document.getElementById('connectSafe');
        const createSafeBtn = document.getElementById('createSafe');
        const refreshBtn = document.getElementById('refreshBtn');
        const proposeBtn = document.getElementById('proposeBtn');
        const proposeForm = document.getElementById('proposeForm');
        const createSafeForm = document.getElementById('createSafeForm');

        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveConfiguration());
        }

        if (loadBtn) {
            loadBtn.addEventListener('click', () => this.loadConfiguration());
        }

        if (connectBtn) {
            connectBtn.addEventListener('click', () => this.connectToSafe());
        }

        if (createSafeBtn) {
            createSafeBtn.addEventListener('click', () => this.openCreateSafeModal());
        }

        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refreshPendingTransactions());
        }

        if (proposeBtn) {
            proposeBtn.addEventListener('click', () => this.openProposeModal());
        }

        if (proposeForm) {
            proposeForm.addEventListener('submit', (e) => this.handleProposeSubmit(e));
        }

        if (createSafeForm) {
            createSafeForm.addEventListener('submit', (e) => this.handleCreateSafeSubmit(e));
        }
    }

    /**
     * Save configuration from form
     */
    saveConfiguration(): void {
        const safeAddress = (document.getElementById('safeAddress') as HTMLInputElement).value;
        const rpcUrl = (document.getElementById('rpcUrl') as HTMLInputElement).value;
        const chainId = 11155111; // Sepolia chainId - hardcoded as in original design
        const txServiceUrl = (document.getElementById('txServiceUrl') as HTMLInputElement).value;
        const privateKey = (document.getElementById('privateKey') as HTMLInputElement).value;

        if (!this.validateConfiguration({ safeAddress, rpcUrl, chainId, txServiceUrl, privateKey })) {
            return;
        }

        this.config = { safeAddress, rpcUrl, chainId, txServiceUrl, privateKey };
        
        // Save to localStorage
        localStorage.setItem('safeConfig', JSON.stringify(this.config));
        
        this.showSuccess('Configuration saved successfully');
        this.initializeApp();
    }

    /**
     * Load configuration from localStorage
     */
    loadConfiguration(): void {
        const saved = localStorage.getItem('safeConfig');
        if (saved) {
            try {
                this.config = JSON.parse(saved);
                this.populateConfigForm();
                this.showSuccess('Configuration loaded successfully!');
            } catch (error) {
                console.error('Failed to load configuration:', error);
                this.showError('Failed to load configuration: ' + (error as Error).message);
            }
        } else {
            this.showError('No saved configuration found');
        }
    }

    /**
     * Populate configuration form with saved values
     */
    populateConfigForm(): void {
        if (this.config) {
            (document.getElementById('safeAddress') as HTMLInputElement).value = this.config.safeAddress || '';
            (document.getElementById('rpcUrl') as HTMLInputElement).value = this.config.rpcUrl || '';
            (document.getElementById('txServiceUrl') as HTMLInputElement).value = this.config.txServiceUrl || '';
            (document.getElementById('privateKey') as HTMLInputElement).value = this.config.privateKey || '';
        }
    }

    /**
     * Validate configuration
     */
    validateConfiguration(config: SafeConfig): boolean {
        if (!config.safeAddress || !config.rpcUrl || !config.txServiceUrl || !config.privateKey) {
            this.showError('All fields are required');
            return false;
        }

        if (!config.safeAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
            this.showError('Invalid Safe address format');
            return false;
        }

        if (!config.privateKey.match(/^0x[a-fA-F0-9]{64}$/)) {
            this.showError('Invalid private key format');
            return false;
        }

        return true;
    }

    /**
     * Connect to Safe and load information
     */
    async connectToSafe(): Promise<void> {
        
        if (!this.config) {
            const errorMessage = 'Please fill in the configuration information and click the "Save Configuration" button to save the configuration!';
            this.showError(errorMessage);
            return;
        }

        // Validate required configuration fields (Safe address is optional)
        if (!this.config.rpcUrl || !this.config.privateKey || !this.config.txServiceUrl) {
            const errorMessage = 'Configuration is incomplete. Please ensure required fields are filled (RPC URL, Transaction Service URL, Private Key)! Safe address is optional.';
            this.showError(errorMessage);
            return;
        }

        // Check if Safe address is provided
        if (!this.config.safeAddress) {
            const errorMessage = 'Safe address is required to connect. Please provide a Safe address or create a new Safe first.';
            console.error('Safe address missing:', errorMessage);
            this.showError(errorMessage);
            this.updateConnectionStatus('No Safe Address');
            return;
        }

        try {
            this.updateConnectionStatus('Connecting...');
            
            // Initialize Safe client first
            this.safeClient = await this.initializeSafeClient();
            
            let safeInfo: SafeInfo;
            
            if (this.safeClient && this.safeClient.protocolKit) {
                // Use Safe SDK
                const address = await this.safeClient.protocolKit.getAddress();
                const nonce = await this.safeClient.protocolKit.getNonce();
                const threshold = await this.safeClient.protocolKit.getThreshold();
                const owners = await this.safeClient.protocolKit.getOwners();
                const isDeployed = await this.safeClient.protocolKit.isSafeDeployed();
                
                safeInfo = {
                    address: address,
                    nonce: nonce,
                    threshold: threshold,
                    owners: owners,
                    modules: [],
                    fallbackHandler: '',
                    guard: '',
                    version: ''
                };
            } else {
                // Fallback to direct API calls
                safeInfo = await this.getSafeInfoFallback();
            }

            // Store Safe info for later use
            this.safeInfo = safeInfo;
            
            this.updateSafeStatus(safeInfo);
            this.updateConnectionStatus('Connected');
            this.showSuccess('Connected to Safe successfully');
            
            // Start auto refresh (this will load pending transactions)
            this.startAutoRefresh();
            
        } catch (error) {
            console.error('Connection failed:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('Error details:', {
                message: errorMessage,
                stack: error instanceof Error ? error.stack : undefined,
                config: this.config
            });
            this.updateConnectionStatus('Failed');
            this.showError(`Failed to connect to Safe: ${errorMessage}`);
        }
    }

    /**
     * Fallback method to get Safe info using direct API calls
     */
    async getSafeInfoFallback(): Promise<SafeInfo> {
        if (!this.config) {
            throw new Error('Configuration not loaded');
        }

        // If no Safe address is provided, create a new Safe
        if (!this.config.safeAddress || this.config.safeAddress.trim() === '') {
            return await this.createNewSafe();
        }

        try {
            const response = await fetch(`${this.config.txServiceUrl}/api/v2/safes/${this.config.safeAddress}/`);
            if (!response.ok) {
                throw new Error(`Failed to fetch Safe info: ${response.statusText}`);
            }

            const data = await response.json();
            return {
                address: data.address,
                nonce: data.nonce,
                threshold: data.threshold,
                owners: data.owners,
                modules: data.modules || [],
                fallbackHandler: data.fallbackHandler || '',
                guard: data.guard || '',
                version: data.version || ''
            };
        } catch (error) {
            console.error('Failed to fetch existing Safe, creating new one:', error);
            return await this.createNewSafe();
        }
    }

    /**
     * Create a new Safe and return its info
     */
    async createNewSafe(): Promise<SafeInfo> {
        if (!this.config) {
            throw new Error('Configuration not loaded');
        }

        // Get signer address from private key
        const signerAddress = this.getSignerAddress(this.config.privateKey);
        
        // For demo purposes, create a mock Safe info
        // In a real implementation, you would deploy a new Safe contract
        const mockSafeAddress = this.generateMockSafeAddress(signerAddress);
        
        // Update config with the new Safe address
        this.config.safeAddress = mockSafeAddress;
        this.saveConfiguration();
        
        return {
            address: mockSafeAddress,
            nonce: 0,
            threshold: 1,
            owners: [signerAddress],
            modules: [],
            fallbackHandler: '',
            guard: '',
            version: '1.3.0'
        };
    }

    /**
     * Generate a mock Safe address for demo purposes
     */
    generateMockSafeAddress(signerAddress: string): string {
        // Create a deterministic address based on signer address
        const hash = this.calculateHash(signerAddress + Date.now().toString());
        return '0x' + hash.slice(0, 40);
    }

    /**
     * Get signer address from private key using viem's privateKeyToAddress
     */
    getSignerAddress(privateKey: string): string {
        try {
            // Ensure private key has '0x' prefix
            const formattedPrivateKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
            
            // Use viem's privateKeyToAddress function to generate the address
            const address = privateKeyToAddress(formattedPrivateKey as `0x${string}`);
            
            return address;
        } catch (error) {
            console.error('Failed to generate address from private key:', error);
            throw new Error('Invalid private key format');
        }
    }

    /**
     * Calculate a simple hash for demo purposes
     */
    calculateHash(input: string): string {
        let hash = 0;
        for (let i = 0; i < input.length; i++) {
            const char = input.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        // Convert to hex and pad to ensure we have enough characters
        const hexHash = Math.abs(hash).toString(16);
        return (hexHash + '0'.repeat(40)).slice(0, 40);
    }

    /**
     * Refresh pending transactions
     */
    async refreshPendingTransactions(): Promise<void> {
        if (!this.config) return;
        
        // Check if Safe address is available before attempting to fetch transactions
        if (!this.config.safeAddress) {
            console.log('No Safe address configured, skipping transaction refresh');
            return;
        }

        try {
            let transactions: PendingTransaction[] = [];

            if (this.safeClient) {
                // Use Safe SDK
                const result = await this.safeClient.getPendingTransactions();
                
                // Safe SDK returns an object with 'results' property containing the transactions array
                if (result && typeof result === 'object' && Array.isArray(result.results)) {
                    // Convert Safe SDK format to our PendingTransaction format
                    transactions = result.results.map((tx: any) => this.convertSafeTransactionFormat(tx));
                } else if (Array.isArray(result)) {
                    // Fallback for direct array response
                    transactions = result.map((tx: any) => this.convertSafeTransactionFormat(tx));
                } else {
                    console.warn('Unexpected result format from Safe SDK:', result);
                    transactions = [];
                }
            } else {
                // Fallback to direct API calls
                transactions = await this.getPendingTransactionsFallback();
            }

            // Store transactions for modal access
            this.pendingTransactions = transactions;
            
            this.renderPendingTransactions(transactions);
            this.resetCountdown();
            
        } catch (error) {
            console.error('Failed to refresh transactions:', error);
            this.showError('Failed to load pending transactions');
        }
    }

    /**
     * Fallback method to get pending transactions
     */
    async getPendingTransactionsFallback(): Promise<PendingTransaction[]> {
        if (!this.config) {
            throw new Error('Configuration not loaded');
        }

        const response = await fetch(
            `${this.config.txServiceUrl}/api/v2/safes/${this.config.safeAddress}/multisig-transactions/?executed=false&ordering=-nonce`
        );
        
        if (!response.ok) {
            throw new Error(`Failed to fetch transactions: ${response.statusText}`);
        }

        const data = await response.json();
        return data.results || [];
    }

    /**
     * Convert Safe SDK transaction format to our PendingTransaction format
     */
    private convertSafeTransactionFormat(tx: any): PendingTransaction {
        return {
            safe: tx.safe || '',
            to: tx.to || '',
            value: tx.value || '0',
            data: tx.data || '0x',
            operation: tx.operation || 0,
            gasToken: tx.gasToken || '0x0000000000000000000000000000000000000000',
            safeTxGas: tx.safeTxGas || 0,
            baseGas: tx.baseGas || 0,
            gasPrice: tx.gasPrice || '0',
            refundReceiver: tx.refundReceiver || '0x0000000000000000000000000000000000000000',
            nonce: tx.nonce || 0,
            executionDate: tx.executionDate || null,
            submissionDate: tx.submissionDate || new Date().toISOString(),
            modified: tx.modified || new Date().toISOString(),
            blockNumber: tx.blockNumber || null,
            transactionHash: tx.transactionHash || null,
            safeTxHash: tx.safeTxHash || '',
            proposer: tx.proposer || '',
            executor: tx.executor || null,
            isExecuted: tx.isExecuted || false,
            isSuccessful: tx.isSuccessful || null,
            ethGasPrice: tx.ethGasPrice || null,
            maxFeePerGas: tx.maxFeePerGas || null,
            maxPriorityFeePerGas: tx.maxPriorityFeePerGas || null,
            gasUsed: tx.gasUsed || null,
            fee: tx.fee || null,
            origin: tx.origin || '',
            dataDecoded: tx.dataDecoded || null,
            confirmationsRequired: tx.confirmationsRequired || 1,
            confirmations: tx.confirmations || [],
            trusted: tx.trusted || false,
            signatures: tx.signatures || null
        };
    }

    /**
     * Render pending transactions in the UI
     */
    renderPendingTransactions(transactions: PendingTransaction[]): void {
        const container = document.getElementById('transactionsContainer');

        if (!container) {
            console.error('Transactions container not found');
            return;
        }

        // Ensure transactions is an array
        if (!Array.isArray(transactions)) {
            console.warn('transactions is not an array:', transactions);
            transactions = [];
        }

        if (transactions.length === 0) {
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
            const validTransactions = transactions.filter(tx => {
                return tx && typeof tx === 'object';
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

            const transactionsToRender = validTransactions;
            
            const renderedCards = transactionsToRender.map((tx, index) => {
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
            });
            
            container.innerHTML = renderedCards.join('');
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
    renderTransactionCard(transaction: PendingTransaction): string {
        // Add null checks for required fields
        if (!transaction) {
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
        
        // Check if current signer has already confirmed this transaction
        const currentSignerAddress = this.config ? this.getSignerAddress(this.config.privateKey) : '';
        const hasCurrentSignerConfirmed = confirmations.some(conf => 
            conf.owner.toLowerCase() === currentSignerAddress.toLowerCase()
        );
        
        const canConfirm = !isConfirmed && !transaction.isExecuted && !hasCurrentSignerConfirmed;
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
                        <div class="detail-value" title="${transaction.to || 'Unknown'}">${this.createTruncatedAddress(transaction.to || 'Unknown')}</div>
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
                    ${hasCurrentSignerConfirmed && !isConfirmed ? `
                        <button class="btn btn-secondary" disabled>
                            Already Confirmed (${confirmations.length}/${confirmationsRequired})
                        </button>
                    ` : ''}
                    ${canExecute && transaction.safeTxHash ? `
                        <button class="btn btn-execute" onclick="safeManager.executeTransaction('${transaction.safeTxHash}')">
                            Execute Transaction
                        </button>
                    ` : ''}
                    <button class="btn btn-primary" onclick="safeManager.viewTransactionDetails('${transaction.safeTxHash || 'no-hash'}')">
                        View Details
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Confirm a transaction
     */
    async confirmTransaction(safeTxHash: string): Promise<void> {
        if (!this.config) return;

        try {
            this.showTransactionsLoading(true, 'Confirming transaction...');

            if (this.safeClient) {
                const result = await this.safeClient.confirm({ safeTxHash: safeTxHash });
            } else {
                await this.confirmTransactionFallback(safeTxHash);
            }

            this.showSuccess('Transaction confirmed successfully');
            await this.refreshPendingTransactions();
            
        } catch (error) {
            console.error('Failed to confirm transaction:', error);
            this.showError('Failed to confirm transaction');
        } finally {
            this.showTransactionsLoading(false);
        }
    }

    /**
     * Fallback method to confirm transaction
     */
    async confirmTransactionFallback(safeTxHash: string): Promise<void> {
        if (!this.config) return;

        const signature = await this.generateSignature(safeTxHash);
        const url = `${this.config.txServiceUrl}/api/v2/multisig-transactions/${safeTxHash}/confirmations/`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                signature: signature
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Response error text:', errorText);
            throw new Error(`Failed to confirm transaction: ${response.statusText} - ${errorText}`);
        }
    }

    /**
     * Execute a transaction
     */
    async executeTransaction(safeTxHash: string): Promise<void> {
        if (!this.config) return;

        try {
            this.showTransactionsLoading(true, 'Executing transaction...');

            if (this.safeClient) {
                // Use Safe SDK - execute via protocolKit
                const pendingTransactions = await this.safeClient.getPendingTransactions();
                const transaction = pendingTransactions.results.find((tx: any) => tx.safeTxHash === safeTxHash);
                if (transaction) {
                    const result = await this.safeClient.protocolKit.executeTransaction(transaction);
                } else {
                    throw new Error('Transaction not found');
                }
            } else {
                // Fallback to direct contract interaction
                await this.executeTransactionFallback(safeTxHash);
            }

            this.showSuccess('Transaction executed successfully');
            await this.refreshPendingTransactions();
            
        } catch (error) {
            console.error('Failed to execute transaction:', error);
            this.showError('Failed to execute transaction');
        } finally {
            this.showTransactionsLoading(false);
        }
    }

    /**
     * Fallback method to execute transaction
     */
    async executeTransactionFallback(safeTxHash: string): Promise<void> {
        // This would require more complex implementation
        // For now, just show a message
        throw new Error('Direct execution not implemented in fallback mode');
    }

    /**
     * Generate signature for a transaction
     */
    async generateSignature(safeTxHash: string): Promise<string> {
        if (!this.config) {
            throw new Error('Configuration not loaded');
        }

        // Wait for ethers to be available
        while (!window.ethers) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        const wallet = new window.ethers.Wallet(this.config.privateKey);
        const signature = await wallet.signMessage(window.ethers.utils.arrayify(safeTxHash));
        
        return signature;
    }



    /**
     * Parse Contract ABI and populate method dropdown
     */
    parseContractAbi(): void {
        const abiTextarea = document.getElementById('proposeContractAbi') as HTMLTextAreaElement;
        const methodSelect = document.getElementById('proposeMethodName') as HTMLSelectElement;
        const paramsTextarea = document.getElementById('proposeMethodParams') as HTMLTextAreaElement;
        
        if (!abiTextarea || !methodSelect || !paramsTextarea) {
            console.error('Required elements not found');
            return;
        }
        
        try {
            // Clear existing options
            methodSelect.innerHTML = '<option value="">Select a method...</option>';
            paramsTextarea.value = '';
            
            const abiText = abiTextarea.value.trim();
            if (!abiText) {
                console.log('ABI text is empty');
                return;
            }
            
            let abi: any[];
            let functions: any[];
            
            try {
                // First try to parse as JSON
                abi = JSON.parse(abiText);
                
                // Check if it's a simplified format (array of strings) or full ABI format
                if (abi.length > 0 && typeof abi[0] === 'string') {
                    // Simplified format - use viem's parseAbi
                    const parsedAbi = parseAbi(abi);
                    
                    // Extract functions from parsed ABI
                    functions = parsedAbi.filter((item: any) => 
                        item.type === 'function' && 
                        item.stateMutability !== 'view' && 
                        item.stateMutability !== 'pure'
                    );
                } else {
                    // Full JSON ABI format
                    functions = abi.filter((item: any) => 
                        item.type === 'function' && 
                        item.stateMutability !== 'view' && 
                        item.stateMutability !== 'pure'
                    );
                }
            } catch (parseError) {
                console.error('Failed to parse ABI with viem:', parseError);
                throw parseError;
            }
            
            console.log('Filtered functions:', functions);
            
            if (functions.length === 0) {
                const option = document.createElement('option');
                option.value = '';
                option.textContent = 'No writable functions found';
                option.disabled = true;
                methodSelect.appendChild(option);
                return;
            }
            
            // Populate method dropdown
            functions.forEach((func: any) => {
                const option = document.createElement('option');
                option.value = func.name;
                option.textContent = func.name;
                option.setAttribute('data-inputs', JSON.stringify(func.inputs || []));
                methodSelect.appendChild(option);
            });
            
        } catch (error) {
            console.error('Failed to parse ABI:', error);
            // Don't show error for incomplete JSON while typing
            if (abiTextarea.value.trim().length > 10) {
                this.showError('Invalid ABI format. Please check your JSON syntax.');
            }
        }
    }

    /**
     * Generate method parameters example based on selected method
     */
    generateMethodParameters(): void {
        const methodSelect = document.getElementById('proposeMethodName') as HTMLSelectElement;
        const paramsTextarea = document.getElementById('proposeMethodParams') as HTMLTextAreaElement;
        
        if (!methodSelect || !paramsTextarea) return;
        
        const selectedOption = methodSelect.selectedOptions[0];
        if (!selectedOption || !selectedOption.value) {
            paramsTextarea.value = '';
            return;
        }
        
        try {
            const inputs = JSON.parse(selectedOption.getAttribute('data-inputs') || '[]');
            
            if (inputs.length === 0) {
                paramsTextarea.value = '[]';
                return;
            }
            
            // Generate example parameters based on type
            const exampleParams = inputs.map((input: any) => {
                return this.generateExampleValue(input.type, input.name);
            });
            
            paramsTextarea.value = JSON.stringify(exampleParams, null, 2);
            
        } catch (error) {
            console.error('Failed to generate parameters:', error);
            paramsTextarea.value = '[]';
        }
    }

    /**
     * Generate example value based on Solidity type
     */
    private generateExampleValue(type: string, name: string): any {
        // Handle array types
        if (type.includes('[]')) {
            const baseType = type.replace('[]', '');
            return [this.generateExampleValue(baseType, name)];
        }
        
        // Handle specific types
        if (type.startsWith('uint') || type.startsWith('int')) {
            return name.toLowerCase().includes('amount') || name.toLowerCase().includes('value') ? 
                "10000" : "1"; // 1 ETH in wei for amounts, 1 for others
        }
        
        if (type === 'address') {
            return "0x4739680F1A3F6aE7E0036979E6A81D76Fd2EE6e3";
        }
        
        if (type === 'bool') {
            return true;
        }
        
        if (type === 'string') {
            return `example_${name}`;
        }
        
        if (type.startsWith('bytes')) {
            return "0x1234567890abcdef";
        }
        
        // Default fallback
        return `<${type}>`;
    }

    /**
     * Open propose transaction modal
     */
    openProposeModal(): void {
        const modal = document.getElementById('proposeModal');
        if (modal) {
            modal.classList.remove('hidden');
        }
    }

    /**
     * Close propose transaction modal
     */
    closeProposeModal(): void {
        const modal = document.getElementById('proposeModal');
        if (modal) {
            modal.classList.add('hidden');
        }
        // Reset form
        const form = document.getElementById('proposeForm') as HTMLFormElement;
        if (form) {
            form.reset();
        }
    }

    /**
     * Open create safe modal
     */
    openCreateSafeModal(): void {
        const modal = document.getElementById('createSafeModal');
        if (modal) {
            modal.classList.remove('hidden');
        }
    }

    /**
     * Close create safe modal
     */
    closeCreateSafeModal(): void {
        const modal = document.getElementById('createSafeModal');
        if (modal) {
            modal.classList.add('hidden');
        }
        // Reset form
        const form = document.getElementById('createSafeForm') as HTMLFormElement;
        if (form) {
            form.reset();
        }
    }

    /**
     * Handle create safe form submission
     */
    async handleCreateSafeSubmit(event: Event): Promise<void> {
        event.preventDefault();
        
        const ownersTextarea = document.getElementById('createSafeOwners') as HTMLTextAreaElement;
        const thresholdInput = document.getElementById('createSafeThreshold') as HTMLInputElement;
        const saltNonceInput = document.getElementById('createSafeSaltNonce') as HTMLInputElement;

        if (!ownersTextarea || !thresholdInput || !saltNonceInput) {
            this.showError('Form elements not found');
            return;
        }

        const ownersText = ownersTextarea.value.trim();
        const threshold = parseInt(thresholdInput.value);
        const saltNonce = saltNonceInput.value.trim();

        // Parse owner addresses
        const owners = ownersText.split('\n')
            .map(addr => addr.trim())
            .filter(addr => addr.length > 0);

        // Validate inputs
        if (owners.length === 0) {
            this.showError('Please provide at least one owner address');
            return;
        }

        if (threshold < 1 || threshold > owners.length) {
            this.showError(`Threshold must be between 1 and ${owners.length}`);
            return;
        }

        if (!saltNonce) {
            this.showError('Please provide a salt nonce');
            return;
        }

        // Validate owner addresses
        for (const owner of owners) {
            if (!this.isValidAddress(owner)) {
                this.showError(`Invalid address: ${owner}`);
                return;
            }
        }

        try {
            await this.createSafe(owners, threshold, saltNonce);
        } catch (error) {
            console.error('Create Safe failed:', error);
            this.showError(`Failed to create Safe: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Create a new Safe wallet
     */
    async createSafe(owners: string[], threshold: number, saltNonce: string): Promise<void> {
        if (!this.config) {
            throw new Error('Configuration not loaded');
        }

        // Validate required configuration fields
        if (!this.config.rpcUrl || !this.config.privateKey || !this.config.txServiceUrl) {
            throw new Error('Configuration is incomplete. Please ensure required fields are filled (RPC URL, Transaction Service URL, Private Key)!');
        }

        // Validate input parameters
        if (!owners || owners.length === 0) {
            throw new Error('At least one owner is required');
        }

        if (threshold < 1 || threshold > owners.length) {
            throw new Error('Threshold must be between 1 and the number of owners');
        }

        // Validate all owner addresses
        for (const owner of owners) {
            if (!isAddress(owner)) {
                throw new Error(`Invalid owner address: ${owner}`);
            }
        }

        this.showCreateSafeLoading(true, 'Initializing Safe deployment...');

        try {
            // Step 1: Configure Safe account settings
            const safeAccountConfig: SafeAccountConfig = {
                owners: owners,
                threshold: threshold
            };

            // Step 2: Configure Safe deployment settings
            const safeDeploymentConfig: SafeDeploymentConfig = {
                saltNonce: saltNonce
            };

            // Step 3: Create predicted Safe configuration
            const predictedSafe: PredictedSafeProps = {
                safeAccountConfig,
                safeDeploymentConfig
            };

            this.showCreateSafeLoading(true, 'Creating Protocol Kit instance...');

            // Step 4: Initialize Protocol Kit with predicted Safe
            const protocolKit = await Safe.init({
                provider: this.config.rpcUrl,
                signer: this.config.privateKey,
                predictedSafe
            });

            // Step 5: Get predicted Safe address
            const predictedSafeAddress = await protocolKit.getAddress();
            console.log('Predicted Safe address:', predictedSafeAddress);

            // Step 6: Check if Safe is already deployed
            const isDeployed = await protocolKit.isSafeDeployed();
            if (isDeployed) {
                throw new Error(`Safe with these parameters is already deployed at address: ${predictedSafeAddress}`);
            }

            this.showCreateSafeLoading(true, 'Creating deployment transaction...');

            // Step 7: Create deployment transaction
            const deploymentTransaction = await protocolKit.createSafeDeploymentTransaction();
            console.log('Deployment transaction created:', deploymentTransaction);

            this.showCreateSafeLoading(true, 'Executing deployment transaction...');

            // Step 8: Execute deployment transaction
            const safeProvider = protocolKit.getSafeProvider();
            const externalSigner = await safeProvider.getExternalSigner();
            
            if (!externalSigner) {
                throw new Error('Failed to get external signer for deployment');
            }

            // Send the deployment transaction
            const transactionHash = await externalSigner.sendTransaction({
                to: deploymentTransaction.to as `0x${string}`,
                value: BigInt(deploymentTransaction.value),
                data: deploymentTransaction.data as `0x${string}`,
                chain: null // Allow the signer to determine the chain
            });

            this.showCreateSafeLoading(true, 'Waiting for transaction confirmation...');

            // Wait for transaction receipt using viem's waitForTransactionReceipt
            const transactionReceipt = await waitForTransactionReceipt(externalSigner, {
                hash: transactionHash
            });

            console.log('Deployment transaction confirmed:', transactionReceipt);

            // Step 9: Connect to the deployed Safe
            this.showCreateSafeLoading(true, 'Connecting to deployed Safe...');
            
            const deployedProtocolKit = await protocolKit.connect({
                safeAddress: predictedSafeAddress
            });

            // Step 10: Verify deployment
            const isSafeDeployed = await deployedProtocolKit.isSafeDeployed();
            if (!isSafeDeployed) {
                throw new Error('Safe deployment verification failed');
            }

            // Step 11: Get Safe information
            const safeAddress = await deployedProtocolKit.getAddress();
            const safeOwners = await deployedProtocolKit.getOwners();
            const safeThreshold = await deployedProtocolKit.getThreshold();
            const safeNonce = await deployedProtocolKit.getNonce();

            console.log('Safe deployed successfully:', {
                address: safeAddress,
                owners: safeOwners,
                threshold: safeThreshold,
                nonce: safeNonce
            });

            // Step 12: Update configuration and UI
            this.config.safeAddress = predictedSafeAddress;
            localStorage.setItem('safeConfig', JSON.stringify(this.config));
            
            // Update the Safe address input field
            const safeAddressInput = document.getElementById('safeAddress') as HTMLInputElement;
            if (safeAddressInput) {
                safeAddressInput.value = predictedSafeAddress;
            }

            // Create a new Safe client for the deployed Safe
            this.safeClient = await createSafeClient({
                provider: this.config.rpcUrl,
                txServiceUrl: this.config.txServiceUrl,
                signer: this.config.privateKey,
                safeAddress: predictedSafeAddress
            });

            // Update Safe info
            const safeInfo: SafeInfo = {
                address: safeAddress,
                nonce: safeNonce,
                threshold: safeThreshold,
                owners: safeOwners,
                modules: [],
                fallbackHandler: '',
                guard: '',
                version: '1.3.0'
            };

            this.safeInfo = safeInfo;
            this.updateSafeStatus(safeInfo);
            this.updateConnectionStatus('Connected');
            
            this.showSuccess(`Safe created successfully! Address: ${this.createTruncatedAddress(predictedSafeAddress)}`);
            this.closeCreateSafeModal();
            
            // Start auto refresh to load any pending transactions
            this.startAutoRefresh();

        } catch (error: any) {
            console.error('Safe creation failed:', error);
            const errorMessage = error?.message || error?.toString() || 'Unknown error occurred';
            this.showError(`Safe creation failed: ${errorMessage}`);
        } finally {
            this.showCreateSafeLoading(false);
        }
    }

    /**
     * Validate Ethereum address format
     */
    private isValidAddress(address: string): boolean {
        return /^0x[a-fA-F0-9]{40}$/.test(address);
    }

    /**
     * Handle propose transaction form submission
     */
    async handleProposeSubmit(event: Event): Promise<void> {
        event.preventDefault();
        
        const targetAddress = (document.getElementById('proposeTargetAddress') as HTMLInputElement)?.value;
        const contractAbi = (document.getElementById('proposeContractAbi') as HTMLTextAreaElement)?.value;
        const methodName = (document.getElementById('proposeMethodName') as HTMLSelectElement)?.value;
        const methodParams = (document.getElementById('proposeMethodParams') as HTMLTextAreaElement)?.value;
        const value = (document.getElementById('proposeValue') as HTMLInputElement)?.value || '0';
        const operation = (document.getElementById('proposeOperation') as HTMLSelectElement)?.value || '0';
        const safeTxGas = (document.getElementById('proposeSafeTxGas') as HTMLInputElement)?.value || '100000';

        if (!targetAddress || !contractAbi || !methodName || !methodParams) {
            this.showError('Please fill in all required fields');
            return;
        }

        // Validate target address format
        if (!isAddress(targetAddress)) {
            this.showError(`Invalid target address: "${targetAddress}". Address must be 42 characters long (including 0x prefix).`);
            return;
        }

        if (!this.config) {
            this.showError('Please configure and connect to Safe first');
            return;
        }

        try {
            this.showProposeLoading(true, 'Proposing transaction...');
            
            await this.proposeTransaction({
                targetAddress,
                contractAbi,
                methodName,
                methodParams,
                value,
                operation: parseInt(operation),
                safeTxGas: parseInt(safeTxGas)
            });

            this.showSuccess('Transaction proposed successfully');
            this.closeProposeModal();
            await this.refreshPendingTransactions();

        } catch (error: any) {
            console.error('Failed to propose transaction:', error);
            this.showError(`Failed to propose transaction: ${error.message}`);
        } finally {
            this.showProposeLoading(false);
        }
    }

    /**
     * Propose a new transaction
     */
    async proposeTransaction(params: {
        targetAddress: string;
        contractAbi: string;
        methodName: string;
        methodParams: string;
        value?: string;
        operation?: number;
        safeTxGas?: number;
    }): Promise<void> {
        const { 
            targetAddress, 
            contractAbi, 
            methodName, 
            methodParams, 
            value = '0', 
            operation = 0, 
            safeTxGas = 100000 
        } = params;

        try {
            // Generate call data
            const callData = this.generateCallData(contractAbi, methodName, methodParams);

            // Create transaction object
            const transaction = {
                to: targetAddress,
                data: callData,
                value: value,
                operation: operation,
                safeTxGas: safeTxGas,
            };

            // Try using Safe SDK first
            if (this.safeClient) {
                try {
                    const result = await this.safeClient.send({ transactions: [transaction] });
                    return;
                } catch (sdkError) {
                    console.warn('Safe SDK failed, using fallback:', sdkError);
                }
            }

            // Fallback to direct API call
            await this.proposeTransactionFallback(transaction);

        } catch (error: any) {
            console.error('Error proposing transaction:', error);
            throw new Error(`Failed to propose transaction: ${error.message}`);
        }
    }

    /**
     * Fallback method to propose transaction via API
     */
    async proposeTransactionFallback(transaction: any): Promise<void> {
        if (!this.config) {
            throw new Error('Configuration not available');
        }

        // Get Safe info
        const safeInfoResponse = await fetch(`${this.config.txServiceUrl}v1/safes/${this.config.safeAddress}/`);
        if (!safeInfoResponse.ok) {
            throw new Error(`Failed to get Safe info: ${safeInfoResponse.status}`);
        }
        const safeInfo = await safeInfoResponse.json();

        // Get signer address from private key
        const signerAddress = this.getSignerAddress(this.config.privateKey);

        // Calculate transaction hash
        const safeTxHash = this.calculateSafeTxHash(transaction, safeInfo.nonce);

        // Prepare transaction data for API
        const transactionData = {
            to: transaction.to,
            value: transaction.value,
            data: transaction.data,
            operation: transaction.operation,
            safeTxGas: transaction.safeTxGas,
            baseGas: 0,
            gasPrice: "0",
            gasToken: "0x0000000000000000000000000000000000000000",
            refundReceiver: "0x0000000000000000000000000000000000000000",
            nonce: safeInfo.nonce,
            contractTransactionHash: safeTxHash,
            sender: signerAddress,
            signature: this.generatePlaceholderSignature(signerAddress),
            origin: 'safe-sign-example'
        };

        const response = await fetch(`${this.config.txServiceUrl}/api/v2/safes/${this.config.safeAddress}/multisig-transactions/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(transactionData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to propose transaction: ${response.statusText} - ${errorText}`);
        }

        const result = await response.json();
    }

    /**
     * Generate call data for contract interaction
     */
    generateCallData(abi: string, methodName: string, params: string): string {
        try {
            // Parse ABI and parameters
            const abiArray = JSON.parse(abi);
            const parameters = JSON.parse(params);
            
            // Try using viem's encodeFunctionData first (most reliable)
            try {
                // Handle both human-readable ABI format and standard JSON ABI format
                let parsedAbi;
                
                if (abiArray.length > 0 && typeof abiArray[0] === 'string') {
                    // Human-readable ABI format - use parseAbi
                    parsedAbi = parseAbi(abiArray);
                } else {
                    // Standard JSON ABI format - use directly
                    parsedAbi = abiArray;
                }
                
                // Use viem's encodeFunctionData
                const callData = encodeFunctionData({
                    abi: parsedAbi,
                    functionName: methodName,
                    args: parameters
                });
                
                return callData;
                
            } catch (viemError: any) {
                console.warn('Viem encoding failed, falling back to ethers:', viemError);
                
                // Fallback to ethers if available
                if (typeof window.ethers !== 'undefined' && window.ethers.Interface) {
                    try {
                        const iface = new window.ethers.Interface(abiArray);
                        return iface.encodeFunctionData(methodName, parameters);
                    } catch (ethersError: any) {
                        console.warn('Ethers encoding also failed:', ethersError);
                        throw new Error(`Both viem and ethers encoding failed. Viem error: ${viemError.message}, Ethers error: ${ethersError.message}`);
                    }
                } else {
                    throw new Error(`Viem encoding failed and ethers is not available: ${viemError.message}`);
                }
            }
            
        } catch (error: any) {
            console.error('Error generating call data:', error);
            throw new Error(`Failed to generate call data: ${error.message}`);
        }
    }

    /**
     * Calculate Safe transaction hash
     */
    calculateSafeTxHash(transaction: any, nonce: number): string {
        // This is a simplified implementation
        // In production, you would use the actual Safe contract's getTransactionHash method
        const data = `${transaction.to}${transaction.value}${transaction.data}${transaction.operation}${nonce}`;
        
        // Simple hash calculation
        let hash = 0;
        for (let i = 0; i < data.length; i++) {
            const char = data.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        
        return '0x' + Math.abs(hash).toString(16).padStart(64, '0');
    }

    /**
     * Generate placeholder signature
     */
    generatePlaceholderSignature(signerAddress: string): string {
        return '0x000000000000000000000000' + signerAddress.slice(2) + 
               '0000000000000000000000000000000000000000000000000000000000000000' +
               '0000000000000000000000000000000000000000000000000000000000000001';
    }

    /**
     * View transaction details
     */
    viewTransactionDetails(safeTxHash: string): void {
        let transaction: PendingTransaction | undefined;
        
        if (safeTxHash === 'no-hash') {
            // If no hash, find the first transaction without safeTxHash
            transaction = this.pendingTransactions.find(tx => !tx.safeTxHash);
        } else {
            // Find transaction by safeTxHash
            transaction = this.pendingTransactions.find(tx => tx.safeTxHash === safeTxHash);
        }
        
        if (!transaction) {
            // Transaction not found
            return;
        }

        // Pause auto refresh when viewing transaction details
        this.pauseAutoRefresh();
        
        // Create and show modal with transaction details
        this.showTransactionModal(transaction);
    }

    /**
     * Show transaction details in a modal
     */
    /**
     * Render pending confirmations showing unconfirmed addresses
     */
    renderPendingConfirmations(confirmations: Array<{owner: string}>, confirmationsRequired: number): string {
        if (!this.safeInfo || confirmationsRequired <= confirmations.length) {
            return '';
        }

        // Get confirmed addresses
        const confirmedAddresses = new Set(confirmations.map(conf => conf.owner.toLowerCase()));
        
        // Get unconfirmed addresses from Safe owners
        const unconfirmedAddresses = this.safeInfo.owners.filter(
            owner => !confirmedAddresses.has(owner.toLowerCase())
        );

        if (unconfirmedAddresses.length === 0) {
            return '';
        }

        return unconfirmedAddresses.map(address => `
            <div class="confirmation-item">
                <span class="confirmation-address" title="${address}">${this.createTruncatedAddress(address)}</span>
                <span class="confirmation-status pending">Pending</span>
            </div>
        `).join('');
    }

    showTransactionModal(transaction: PendingTransaction): void {
        const modalContent = document.getElementById('transactionDetailsContent');
        if (!modalContent) return;

        const confirmations = transaction.confirmations || [];
        const confirmationsRequired = transaction.confirmationsRequired || 0;

        modalContent.innerHTML = `
            <div class="transaction-detail-item">
                <span class="transaction-detail-label">Transaction Hash:</span>
                <span class="transaction-detail-value hash">${transaction.safeTxHash || 'Not available (transaction not yet created)'}</span>
            </div>
            <div class="transaction-detail-item">
                <span class="transaction-detail-label">To Address:</span>
                <span class="transaction-detail-value hash" title="${transaction.to || 'N/A'}">${this.createTruncatedAddress(transaction.to || 'N/A')}</span>
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
                <span class="transaction-detail-value">${transaction.safeTxGas || 'N/A'}</span>
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
                            <span class="confirmation-address" title="${conf.owner || 'Unknown'}">${this.createTruncatedAddress(conf.owner || 'Unknown')}</span>
                            <span class="confirmation-status confirmed">Confirmed</span>
                        </div>
                    `).join('') : ''}
                    ${this.renderPendingConfirmations(confirmations, confirmationsRequired)}
                </div>
            </div>
        `;

        // Show modal
        const modal = document.getElementById('transactionModal');
        if (modal) {
            modal.classList.remove('hidden');

            // Add click outside to close
            modal.onclick = (e) => {
                if (e.target === modal) {
                    this.closeTransactionModal();
                }
            };
        }
    }

    /**
     * Close transaction details modal
     */
    closeTransactionModal(): void {
        const modal = document.getElementById('transactionModal');
        if (modal) {
            modal.classList.add('hidden');
            modal.onclick = null;
        }
        
        // Resume auto refresh when modal is closed
        this.resumeAutoRefresh();
    }

    /**
     * Pause auto refresh
     */
    pauseAutoRefresh(): void {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
    }

    /**
     * Resume auto refresh
     */
    resumeAutoRefresh(): void {
        this.startAutoRefresh();
    }

    /**
     * Update Safe status display
     */
    updateSafeStatus(safeInfo: SafeInfo): void {
        // Update Safe Address
        const safeAddressElement = document.getElementById('currentSafeAddress');
        if (safeAddressElement) {
            safeAddressElement.textContent = this.createTruncatedAddress(safeInfo.address);
            safeAddressElement.title = safeInfo.address; // Add tooltip with full address
        }

        // Update Is Deployed status
        const isDeployedElement = document.getElementById('isDeployed');
        if (isDeployedElement) {
            isDeployedElement.textContent = 'Yes';
            isDeployedElement.className = 'status-value deployed';
        }

        // Update Signer Address
        const signerAddressElement = document.getElementById('signerAddress');
        if (signerAddressElement && this.config) {
            const signerAddr = this.getSignerAddress(this.config.privateKey);
            signerAddressElement.textContent = this.createTruncatedAddress(signerAddr);
            signerAddressElement.title = signerAddr; // Add tooltip with full address
        }

        // Update Signer Balance with real balance query
        const signerBalanceElement = document.getElementById('signerBalance');
        if (signerBalanceElement && this.config) {
            const signerAddr = this.getSignerAddress(this.config.privateKey);
            this.updateSignerBalance(signerAddr, signerBalanceElement);
        }

        // Update the legacy safeStatus element if it exists
        const statusElement = document.getElementById('safeStatus');
        if (statusElement) {
            statusElement.innerHTML = `
                <div><strong>Address:</strong> ${this.createTruncatedAddress(safeInfo.address)}</div>
                <div><strong>Threshold:</strong> ${safeInfo.threshold}/${safeInfo.owners.length}</div>
                <div><strong>Nonce:</strong> ${safeInfo.nonce}</div>
            `;
        }
    }

    /**
     * Update signer balance with real balance query
     */
    async updateSignerBalance(signerAddress: string, element: HTMLElement): Promise<void> {
        try {
            if (!this.config) {
                element.textContent = 'N/A';
                return;
            }

            const balance = await this.getAddressBalance(signerAddress);
            element.textContent = balance;
        } catch (error) {
            console.error('Error updating signer balance:', error);
            element.textContent = 'Error';
        }
    }

    /**
     * Get address balance using RPC call
     */
    async getAddressBalance(address: string): Promise<string> {
        try {
            if (!this.config) {
                throw new Error('Configuration not loaded');
            }

            const response = await fetch(this.config.rpcUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'eth_getBalance',
                    params: [address, 'latest'],
                    id: 1
                })
            });

            if (!response.ok) {
                throw new Error(`RPC request failed: ${response.statusText}`);
            }

            const data = await response.json();
            if (data.error) {
                throw new Error(`RPC error: ${data.error.message}`);
            }

            // Convert from wei to ETH
            const balanceWei = BigInt(data.result);
            const balanceEth = Number(balanceWei) / Math.pow(10, 18);
            return balanceEth.toFixed(2);
        } catch (error) {
            console.error('Error getting address balance:', error);
            return '0.00';
        }
    }

    /**
     * Update connection status
     */
    updateConnectionStatus(status: string): void {
        const statusElement = document.getElementById('connectionStatus');
        if (statusElement) {
            statusElement.textContent = status;
            statusElement.className = `status ${status.toLowerCase()}`;
        }
    }

    /**
     * Create truncated address for display
     */
    createTruncatedAddress(address: string): string {
        if (!address) return '';
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }

    /**
     * Start auto refresh
     */
    startAutoRefresh(): void {
        this.stopAutoRefresh();
        
        // Immediately load transactions
        this.refreshPendingTransactions();
        
        // Set up interval for future refreshes
        this.refreshInterval = setInterval(() => {
            this.refreshPendingTransactions();
        }, 10000);
        this.startCountdown();
    }

    /**
     * Stop auto refresh
     */
    stopAutoRefresh(): void {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
    }

    /**
     * Start countdown timer
     */
    startCountdown(): void {
        // Clear any existing countdown
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
        
        this.countdownSeconds = 10;
        this.updateCountdownDisplay();
        
        this.countdownInterval = setInterval(() => {
            this.countdownSeconds--;
            this.updateCountdownDisplay();
            if (this.countdownSeconds <= 0) {
                this.resetCountdown();
            }
        }, 1000);
    }

    /**
     * Reset countdown
     */
    resetCountdown(): void {
        // Only reset the counter, don't restart the interval
        this.countdownSeconds = 10;
        this.updateCountdownDisplay();
    }

    /**
     * Update countdown display
     */
    updateCountdownDisplay(): void {
        const countdownElement = document.getElementById('countdownTimer');
        if (countdownElement) {
            countdownElement.textContent = `${this.countdownSeconds}s`;
        }
    }

    /**
     * Show loading state
     */
    showTransactionsLoading(show: boolean, message: string = 'Loading...'): void {
        const loadingOverlay = document.getElementById('transactionsLoadingOverlay');
        const loadingText = document.querySelector('.transactions-loading-text');
        
        if (loadingOverlay) {
            if (show) {
                if (loadingText) {
                    loadingText.textContent = message;
                }
                loadingOverlay.classList.remove('hidden');
            } else {
                loadingOverlay.classList.add('hidden');
            }
        }
    }

    /**
     * Show or hide loading overlay for Propose Transaction modal
     */
    showProposeLoading(show: boolean, message: string = 'Proposing transaction...'): void {
        const overlay = document.getElementById('proposeLoadingOverlay');
        const messageElement = overlay?.querySelector('.modal-loading-text');
        
        if (overlay) {
            if (show) {
                overlay.classList.remove('hidden');
                if (messageElement) {
                    messageElement.textContent = message;
                }
            } else {
                overlay.classList.add('hidden');
            }
        }
    }

    /**
     * Show or hide loading overlay for Create Safe modal
     */
    showCreateSafeLoading(show: boolean, message: string = 'Creating Safe...'): void {
        const overlay = document.getElementById('createSafeLoadingOverlay');
        const messageElement = overlay?.querySelector('.modal-loading-text');
        
        if (overlay) {
            if (show) {
                overlay.classList.remove('hidden');
                if (messageElement) {
                    messageElement.textContent = message;
                }
            } else {
                overlay.classList.add('hidden');
            }
        }
    }

    /**
     * Show error message
     */
    showError(message: string, type: string = 'error'): void {
        const errorDisplay = document.getElementById('errorDisplay');
        const errorMessage = document.getElementById('errorMessage');
        
        if (errorDisplay && errorMessage) {
            errorMessage.textContent = message;
            errorDisplay.className = `error-display ${type === 'success' ? 'success' : ''}`;
            errorDisplay.classList.remove('hidden');
            
            // Auto hide after 5 seconds
            setTimeout(() => {
                if (errorDisplay) {
                    errorDisplay.classList.add('hidden');
                }
            }, 5000);
        }
    }

    /**
     * Show success message
     */
    showSuccess(message: string): void {
        const successDisplay = document.getElementById('successDisplay');
        const successMessage = document.getElementById('successMessage');
        
        if (successDisplay && successMessage) {
            successMessage.textContent = message;
            successDisplay.classList.remove('hidden');
            
            // Auto hide after 5 seconds
            setTimeout(() => {
                if (successDisplay) {
                    successDisplay.classList.add('hidden');
                }
            }, 5000);
        }
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.safeManager = new SafeManager();
    window.safeManager.initializeApp();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.safeManager) {
        window.safeManager.stopAutoRefresh();
    }
});

// Export for global access
window.showError = (message: string, type: string = 'error') => {
    if (window.safeManager) {
        window.safeManager.showError(message, type);
    }
};

window.hideError = () => {
    const errorDisplay = document.getElementById('errorDisplay');
    if (errorDisplay) {
        errorDisplay.classList.add('hidden');
    }
};

window.hideSuccess = () => {
    const successDisplay = document.getElementById('successDisplay');
    if (successDisplay) {
        successDisplay.classList.add('hidden');
    }
};

window.showSuccess = (message: string) => {
    if (window.safeManager) {
        window.safeManager.showSuccess(message);
    }
};