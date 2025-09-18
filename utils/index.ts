import { encodeFunctionData, parseAbi } from 'viem'

/**
 * Generate transfer call data for ERC20 token transfer
 * @param to - The recipient address
 * @param amount - The amount to transfer (in token's smallest unit)
 * @returns The encoded function data for the transfer call
 */
export const generateTransferCallData = (to: string, value: bigint) => {
    const functionAbi = parseAbi(['function transfer(address _to, uint256 _value) returns (bool)'])

    return encodeFunctionData({
        abi: functionAbi,
        functionName: 'transfer',
        args: [to as `0x${string}`, value]
    })
  }