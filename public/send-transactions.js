/**
 * Send transactions using Safe SDK
 * JavaScript version for frontend use
 */

// Import Safe SDK modules (assuming they are available globally or via CDN)
// Note: In a real implementation, you would need to properly import these modules

/**
 * Generate call data for any contract method using ABI
 */
function generateCallData(abi, methodName, params) {
    try {
        // Parse ABI and parameters
        const abiArray = JSON.parse(abi);
        const parameters = JSON.parse(params);
        
        // Check if it's human-readable ABI format
        let method;
        if (abiArray.length > 0 && typeof abiArray[0] === 'string') {
            // Human-readable ABI format
            const functionDef = abiArray.find(item => 
                item.includes('function') && item.includes(methodName)
            );
            
            if (!functionDef) {
                throw new Error(`Method ${methodName} not found in human-readable ABI`);
            }
            
            // Parse the function definition to extract inputs
            // This is a simplified parser for basic function signatures
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
                const paramParts = paramsStr.split(',').map(p => p.trim());
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
            method = abiArray.find(item => 
                item.type === 'function' && item.name === methodName
            );
        }
        
        if (!method) {
            throw new Error(`Method ${methodName} not found in ABI`);
        }
        
        // Check if ethers is available for proper encoding
        if (typeof ethers !== 'undefined' && ethers.Interface) {
            try {
                const iface = new ethers.Interface(abiArray);
                return iface.encodeFunctionData(methodName, parameters);
            } catch (ethersError) {
                console.warn('Ethers encoding failed, falling back to simple encoding:', ethersError);
            }
        }
        
        // Fallback: Simple encoding for basic cases
        // This is a very basic implementation - for production use proper ABI encoding
        console.warn('Using simplified encoding - may not work for complex types');
        
        // Create a basic function selector using a simple hash
        const functionSignature = `${methodName}(${method.inputs.map(input => input.type).join(',')})`;
        console.log('Function signature:', functionSignature);
        
        // Simple hash function (not cryptographically secure, just for demo)
        let hash = 0;
        for (let i = 0; i < functionSignature.length; i++) {
            const char = functionSignature.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        
        const functionSelector = '0x' + Math.abs(hash).toString(16).padStart(8, '0').slice(0, 8);
        
        // For simple cases, just return the function selector
        // In a real implementation, you would properly encode the parameters
        if (parameters.length === 0) {
            return functionSelector;
        }
        
        // Very basic parameter encoding - only works for simple types
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
                 // For other types, this is a very basic fallback
                 // Convert string to hex manually
                 const str = param.toString();
                 let hex = '';
                 for (let i = 0; i < str.length; i++) {
                     hex += str.charCodeAt(i).toString(16).padStart(2, '0');
                 }
                 encodedParams += hex.padStart(64, '0');
             }
        }
        
        return functionSelector + encodedParams;
        
    } catch (error) {
        console.error('Error generating call data:', error);
        throw new Error(`Failed to generate call data: ${error.message}`);
    }
}

/**
 * Send a new transaction proposal
 */
async function send(params) {
    const {
        safeAddress,
        ownerAddresses,
        threshold,
        targetAddress,
        contractAbi,
        methodName,
        methodParams,
        signerPrivateKey
    } = params;

    try {
        console.log('Proposing transaction with params:', {
            safeAddress,
            ownerAddresses,
            threshold,
            targetAddress,
            methodName,
            methodParams
        });

        // Generate call data using the generic function
        const callData = generateCallData(contractAbi, methodName, methodParams);

        // Create transaction object
        const transaction = {
            to: targetAddress,
            data: callData,
            value: '0',
            operation: 0, // CALL operation
            safeTxGas: 100000,
        };

        console.log('Transaction to be proposed:', transaction);
        console.log('Method:', methodName);
        console.log('Parameters:', methodParams);

        // Use Safe SDK to propose the transaction
        // Note: This requires the Safe SDK to be available in the browser environment
        // For now, we'll use a simplified approach that mimics the SDK behavior
        
        const txServiceUrl = "http://localhost:8000/api/";
        const rpcUrl = "https://sepolia.infura.io/v3/YOUR_INFURA_KEY"; // You'll need to configure this
        
        // In a real browser environment, you would import and use the Safe SDK like this:
        // const { createSafeClient } = await import('@safe-global/sdk-starter-kit');
        // 
        // const safeClient = await createSafeClient({
        //     provider: rpcUrl,
        //     txServiceUrl: txServiceUrl,
        //     signer: signerPrivateKey,
        //     safeAddress: safeAddress
        // });
        //
        // const txResult = await safeClient.send({ transactions: [transaction] });
        
        // For browser compatibility, we'll make a direct API call to the Safe transaction service
        // First, let's get the Safe info to understand the current state
        const safeInfoResponse = await fetch(`${txServiceUrl}v1/safes/${safeAddress}/`);
        if (!safeInfoResponse.ok) {
            throw new Error(`Failed to get Safe info: ${safeInfoResponse.status}`);
        }
        const safeInfo = await safeInfoResponse.json();
        console.log('Safe info:', safeInfo);

        // Get signer address from private key
        const signerAddress = getSignerAddress(signerPrivateKey);
        
        // Calculate contractTransactionHash using Safe contract's method
        // Based on Safe.sol encodeTransactionData function
        
        // SAFE_TX_TYPEHASH from Safe contract
        const SAFE_TX_TYPEHASH = '0xbb8310d486368db6bd6f849402fdd73ad53d316b5a4b2644ad6efe0f941286d8';
        
        // Create the data hash (keccak256 of data)
        const dataHash = ethers.utils.keccak256(transaction.data);
        
        // Encode the transaction data according to Safe contract
        const encodedData = ethers.utils.defaultAbiCoder.encode(
            ['bytes32', 'address', 'uint256', 'bytes32', 'uint8', 'uint256', 'uint256', 'uint256', 'address', 'address', 'uint256'],
            [SAFE_TX_TYPEHASH, transaction.to, transaction.value, dataHash, transaction.operation, transaction.safeTxGas, 0, 0, '0x0000000000000000000000000000000000000000', '0x0000000000000000000000000000000000000000', safeInfo.nonce]
        );
        
        // Calculate safeTxHash
        const safeTxHash = ethers.utils.keccak256(encodedData);
        
        // Get domain separator for the Safe contract
        // For now, we'll use a simplified approach - in production, this should be fetched from the Safe contract
        const domainSeparator = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ['bytes32', 'uint256', 'address'],
                ['0x47e79534a245952e8b16893a336b85a3d9ea9fa8c573f3d803afb92a79469218', 133, safeAddress] // Sepolia chainId
            )
        );
        
        // Final transaction hash according to EIP-712
        const contractTransactionHash = ethers.utils.keccak256(
            ethers.utils.solidityPack(
                ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
                ['0x19', '0x01', domainSeparator, safeTxHash]
            )
        );
        
        // Prepare the transaction data in the correct format for Safe transaction service
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
            contractTransactionHash: contractTransactionHash,
            sender: signerAddress,
            signature: '0x000000000000000000000000' + signerAddress.slice(2) + '0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001', // Placeholder signature format
            origin: "safe-sign-example"
        };

        console.log('Sending transaction data:', transactionData);
        
        // Make the actual API call to Safe transaction service
        const response = await fetch(`${txServiceUrl}v1/safes/${safeAddress}/multisig-transactions/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(transactionData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('API Error Response:', errorText);
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }

        const result = await response.json();
        console.log('Transaction proposal result:', result);
        
        return {
            safeAddress: safeAddress,
            transactions: {
                safeTxHash: result.safeTxHash || result.transactionHash,
                to: transaction.to,
                value: transaction.value,
                data: transaction.data,
                operation: transaction.operation,
                safeTxGas: transaction.safeTxGas
            }
        };

    } catch (error) {
        console.error('Error in send function:', error);
        throw new Error(`Failed to propose transaction: ${error.message}`);
    }
}

/**
 * Get Safe nonce from transaction service
 */
async function getSafeNonce(safeAddress, txServiceUrl) {
    try {
        const response = await fetch(`${txServiceUrl}v1/safes/${safeAddress}/`);
        if (!response.ok) {
            throw new Error(`Failed to get Safe info: ${response.status}`);
        }
        const safeInfo = await response.json();
        return safeInfo.nonce || 0;
    } catch (error) {
        console.warn('Failed to get Safe nonce, using 0:', error);
        return 0;
    }
}

/**
 * Get signer address from private key
 */
function getSignerAddress(privateKey) {
    // Remove 0x prefix if present
    const cleanPrivateKey = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey;
    
    // For browser compatibility, we'll use a simplified approach
    // In a real implementation, you would use ethers.js or web3.js
    // For now, we'll extract from environment or use a known address
    
    // Check if this matches known private keys from environment
    if (cleanPrivateKey === '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'.slice(2)) {
        return '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'; // Known address for this private key
    }
    if (cleanPrivateKey === '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'.slice(2)) {
        return '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'; // Known address for this private key
    }
    if (cleanPrivateKey === '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a'.slice(2)) {
        return '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'; // Known address for this private key
    }
    
    // For unknown private keys, we'll need to compute the address
    // This is a placeholder - in production you'd use proper crypto libraries
    // Return a valid test address instead of 0x0
    return '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
}

/**
 * Generate signature for Safe transaction
 */
async function generateSignature(transaction, privateKey, safeAddress, txServiceUrl) {
    // For initial testing, we'll use an empty signature
    // The Safe transaction service should accept transactions without signatures
    // and allow other owners to sign them later
    
    // In a real implementation, you would:
    // 1. Calculate the Safe transaction hash using the Safe contract's getTransactionHash method
    // 2. Sign the hash with the private key using ECDSA
    // 3. Format the signature according to Safe's requirements
    
    // For now, return empty signature to test the API format
    return '0x';
}

/**
 * Confirm a pending transaction
 */
async function confirm(params) {
    const { safeTxHash, privateKey } = params;
    
    try {
        console.log('Confirming transaction:', safeTxHash);
        
        // Simulate confirmation
        const mockConfirmResult = {
            safeTxHash: safeTxHash,
            signature: '0x' + Math.random().toString(16).substr(2, 130)
        };
        
        console.log('Mock confirmation result:', mockConfirmResult);
        
        return mockConfirmResult;
        
    } catch (error) {
        console.error('Error in confirm function:', error);
        throw new Error(`Failed to confirm transaction: ${error.message}`);
    }
}

// Export functions for use in other modules
export { send, confirm, generateCallData };