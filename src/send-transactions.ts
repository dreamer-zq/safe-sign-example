import * as dotenv from 'dotenv'
import { Hex } from 'viem'
import { privateKeyToAddress } from 'viem/accounts'
import { SafeClientResult, createSafeClient } from '@safe-global/sdk-starter-kit'
import { generateTransferCallData } from '../utils/index.js'

// Load environment variables from ./.env file
dotenv.config()

// Follow .env-sample as an example to create your own file
const {
    OWNER_1_PRIVATE_KEY = '0x',
    OWNER_2_PRIVATE_KEY = '0x',
    OWNER_3_PRIVATE_KEY = '0x',
    RPC_URL = '',
    THRESHOLD,
    SALT_NONCE
} = process.env

const usdcTokenAddress = '0x4739680F1A3F6aE7E0036979E6A81D76Fd2EE6e3' // SEPOLIA
const usdcAmount = 100n
const txServiceUrl = "http://localhost:8000/api/"

async function send(): Promise<SafeClientResult> {
    const owner1 = privateKeyToAddress(OWNER_1_PRIVATE_KEY as Hex)
    const owner2 = privateKeyToAddress(OWNER_2_PRIVATE_KEY as Hex)
    const owner3 = privateKeyToAddress(OWNER_3_PRIVATE_KEY as Hex)

    const safeClient = await createSafeClient({
        provider: RPC_URL,
        txServiceUrl: txServiceUrl,
        signer: OWNER_1_PRIVATE_KEY,
        safeOptions: {
            owners: [owner1, owner2, owner3],
            threshold: Number(THRESHOLD),
            saltNonce: SALT_NONCE
        }
    })

    const signerAddress = (await safeClient.protocolKit.getSafeProvider().getSignerAddress()) || '0x'

    const transferUSDC = {
        to: usdcTokenAddress,
        data: generateTransferCallData(signerAddress, usdcAmount),
        value: '0',
        operation: 0,
        safeTxGas: 100000,
    }
    const transactions = [transferUSDC]
    const txResult = await safeClient.send({ transactions })

    return txResult
}

async function confirm({ safeAddress, transactions }: SafeClientResult, pk: string) {
    if (!pk) {
        return
    }

    const safeClient = await createSafeClient({
        txServiceUrl,
        provider: RPC_URL,
        signer: pk,
        safeAddress
    })

    const signerAddress = (await safeClient.protocolKit.getSafeProvider().getSignerAddress()) || '0x'

    const pendingTransactions = await safeClient.getPendingTransactions()

    for (const transaction of pendingTransactions.results) {
        if (transaction.safeTxHash !== transactions?.safeTxHash) {
            return
        }

        const txResult = await safeClient.confirm({ safeTxHash: transaction.safeTxHash })
    }
}

async function main() {
    const threshold = Number(THRESHOLD)
    if (![1, 2, 3].includes(threshold)) {
        return
    }

    const txResult = await send()

    // if (threshold > 1) {
        // await confirm(txResult, OWNER_2_PRIVATE_KEY)
    // }

    // //@ts-ignore-next-line
    // if (threshold > 2) {
    //     await confirm(txResult, OWNER_3_PRIVATE_KEY)
    // }
}

main()
