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
import { createSafeClient } from '@safe-global/sdk-starter-kit';
// Viem imports for address generation
import { privateKeyToAddress } from 'viem/accounts';

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
    private safeClient: any = null;
    private refreshInterval: NodeJS.Timeout | null = null;
    private countdownInterval: NodeJS.Timeout | null = null;
    private countdownSeconds: number = 30;
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
        const refreshBtn = document.getElementById('refreshBtn');
        const proposeBtn = document.getElementById('proposeBtn');
        const proposeForm = document.getElementById('proposeForm');

        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveConfiguration());
        }

        if (loadBtn) {
            loadBtn.addEventListener('click', () => this.loadConfiguration());
        }

        if (connectBtn) {
            connectBtn.addEventListener('click', () => this.connectToSafe());
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
            const errorMessage = '请先填写配置信息并点击"Save Configuration"按钮保存配置！';
            console.error('Configuration missing:', errorMessage);
            this.showError(errorMessage);
            alert(errorMessage);
            return;
        }

        // Validate required configuration fields (Safe address is optional)
        if (!this.config.rpcUrl || !this.config.privateKey || !this.config.txServiceUrl) {
            const errorMessage = '配置信息不完整，请确保填写必需字段（RPC URL、交易服务URL、私钥）！Safe地址可选。';
            console.error('Incomplete configuration:', errorMessage);
            this.showError(errorMessage);
            alert(errorMessage);
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
            const response = await fetch(`${this.config.txServiceUrl}/api/v1/safes/${this.config.safeAddress}/`);
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

        try {
            let transactions: PendingTransaction[] = [];

            if (this.safeClient) {
                // Use Safe SDK
                const result = await this.safeClient.getPendingTransactions();
                
                // Ensure we have an array
                if (Array.isArray(result)) {
                    transactions = result;
                } else if (result && Array.isArray(result.results)) {
                    transactions = result.results;
                } else if (result && result.data && Array.isArray(result.data)) {
                    transactions = result.data;
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
                const result = await this.safeClient.confirm(safeTxHash);
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

        const signerAddress = this.getSignerAddress(this.config.privateKey);
        
        const signature = await this.generateSignature(safeTxHash);

        const url = `${this.config.txServiceUrl}/api/v1/multisig-transactions/${safeTxHash}/confirmations/`;

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
     * Handle propose transaction form submission
     */
    async handleProposeSubmit(event: Event): Promise<void> {
        event.preventDefault();
        
        const targetAddress = (document.getElementById('proposeTargetAddress') as HTMLInputElement)?.value;
        const contractAbi = (document.getElementById('proposeContractAbi') as HTMLTextAreaElement)?.value;
        const methodName = (document.getElementById('proposeMethodName') as HTMLInputElement)?.value;
        const methodParams = (document.getElementById('proposeMethodParams') as HTMLTextAreaElement)?.value;
        const value = (document.getElementById('proposeValue') as HTMLInputElement)?.value || '0';
        const operation = (document.getElementById('proposeOperation') as HTMLSelectElement)?.value || '0';
        const safeTxGas = (document.getElementById('proposeSafeTxGas') as HTMLInputElement)?.value || '100000';

        if (!targetAddress || !contractAbi || !methodName || !methodParams) {
            this.showError('Please fill in all required fields');
            return;
        }

        if (!this.config) {
            this.showError('Please configure and connect to Safe first');
            return;
        }

        try {
            this.showTransactionsLoading(true, 'Proposing transaction...');
            
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
            this.showTransactionsLoading(false);
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

        const response = await fetch(`${this.config.txServiceUrl}/api/v1/safes/${this.config.safeAddress}/multisig-transactions/`, {
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
     * Generate call data for contract method
     */
    generateCallData(abi: string, methodName: string, params: string): string {
        try {
            // Parse ABI and parameters
            const abiArray = JSON.parse(abi);
            const parameters = JSON.parse(params);
            
            // Check if ethers is available for proper encoding
            if (typeof window.ethers !== 'undefined' && window.ethers.Interface) {
                try {
                    const iface = new window.ethers.Interface(abiArray);
                    return iface.encodeFunctionData(methodName, parameters);
                } catch (ethersError) {
                    console.warn('Ethers encoding failed, falling back to simple encoding:', ethersError);
                }
            }
            
            // Fallback: Find method in ABI
            let method;
            if (abiArray.length > 0 && typeof abiArray[0] === 'string') {
                // Human-readable ABI format
                const functionDef = abiArray.find((item: string) => 
                    item.includes('function') && item.includes(methodName)
                );
                
                if (!functionDef) {
                    throw new Error(`Method ${methodName} not found in human-readable ABI`);
                }
                
                // Parse the function definition
                const match = functionDef.match(/function\s+(\w+)\s*\(([^)]*)\)/);
                if (!match) {
                    throw new Error(`Invalid function definition: ${functionDef}`);
                }
                
                const [, funcName, paramsStr] = match;
                if (funcName !== methodName) {
                    throw new Error(`Method name mismatch: expected ${methodName}, found ${funcName}`);
                }
                
                // Parse parameters
                const inputs = [];
                if (paramsStr.trim()) {
                    const paramParts = paramsStr.split(',').map((p: string) => p.trim());
                    for (const param of paramParts) {
                        const parts = param.split(/\s+/);
                        if (parts.length >= 2) {
                            inputs.push({
                                type: parts[0],
                                name: parts[1]
                            });
                        }
                    }
                }
                
                method = {
                    name: methodName,
                    type: 'function',
                    inputs: inputs
                };
            } else {
                // Standard JSON ABI format
                method = abiArray.find((item: any) => 
                    item.type === 'function' && item.name === methodName
                );
            }
            
            if (!method) {
                throw new Error(`Method ${methodName} not found in ABI`);
            }
            
            // Simple function selector generation
            const functionSignature = `${methodName}(${method.inputs.map((input: any) => input.type).join(',')})`;
            
            // Simple hash function for function selector
            let hash = 0;
            for (let i = 0; i < functionSignature.length; i++) {
                const char = functionSignature.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash; // Convert to 32-bit integer
            }
            
            const functionSelector = '0x' + Math.abs(hash).toString(16).padStart(8, '0').slice(0, 8);
            
            // Basic parameter encoding
            if (parameters.length === 0) {
                return functionSelector;
            }
            
            let encodedParams = '';
            for (let i = 0; i < parameters.length && i < method.inputs.length; i++) {
                const param = parameters[i];
                const inputType = method.inputs[i].type;
                
                if (inputType === 'address') {
                    encodedParams += param.replace('0x', '').toLowerCase().padStart(64, '0');
                } else if (inputType.startsWith('uint')) {
                    const value = BigInt(param);
                    encodedParams += value.toString(16).padStart(64, '0');
                } else {
                    // For other types, basic fallback
                    const str = param.toString();
                    let hex = '';
                    for (let j = 0; j < str.length; j++) {
                        hex += str.charCodeAt(j).toString(16).padStart(2, '0');
                    }
                    encodedParams += hex.padStart(64, '0');
                }
            }
            
            return functionSelector + encodedParams;
            
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
        }, 30000);
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
        
        this.countdownSeconds = 30;
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
        this.countdownSeconds = 30;
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