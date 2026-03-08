/**
 * AgentLink Constants
 * 
 * Contract Addresses and Configuration
 * Updated: 2026-03-09
 */

// Network Configuration
export const NETWORKS = {
  'base-sepolia': {
    chainId: 84532,
    rpcUrl: 'https://sepolia.base.org',
    explorer: 'https://sepolia.basescan.org',
    contracts: {
      // NEW DEPLOYED CONTRACTS (Security Fixed Version)
      agentReputation: '0x7C56670BA983546A650e70E8D106631d69a56000' as `0x${string}`,
      paymentRouter: '0xf17EDf5B92aAa0b7a3FE7D123906c71f94516D59' as `0x${string}`,
      usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as `0x${string}`,
      
      // OLD CONTRACTS (Deprecated - Pre Security Audit)
      // agentReputationOld: '0xfAFCF11ca021d9efd076b158bf1b4E8be18572ca',
      // paymentRouterOld: '0x116f7A6A3499fE8B1Ffe41524CCA6573C18d18fF',
    },
    platformFeePercent: 100, // 1% = 100 basis points
  },
  'base-mainnet': {
    chainId: 8453,
    rpcUrl: 'https://mainnet.base.org',
    explorer: 'https://basescan.org',
    contracts: {
      // TODO: Deploy to mainnet
      agentReputation: '0xTBD' as `0x${string}`,
      paymentRouter: '0xTBD' as `0x${string}`,
      usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as `0x${string}`,
    },
    platformFeePercent: 100,
  },
};

// Export active network
export const ACTIVE_NETWORK = NETWORKS['base-sepolia'];

// Contract ABIs (Minimal for interaction)
export const AGENT_REPUTATION_ABI = [
  {
    inputs: [{ internalType: 'address', name: '_treasury', type: 'address' }],
    stateMutability: 'nonpayable',
    type: 'constructor',
  },
  {
    inputs: [
      { internalType: 'address', name: '_agent', type: 'address' },
      { internalType: 'uint256', name: '_score', type: 'uint256' },
      { internalType: 'string', name: '_comment', type: 'string' },
      { internalType: 'bytes32', name: '_dealId', type: 'bytes32' },
    ],
    name: 'addReview',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: '_agent', type: 'address' },
      { internalType: 'bool', name: '_successful', type: 'bool' },
      { internalType: 'uint256', name: '_score', type: 'uint256' },
    ],
    name: 'updateReputation',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: '_agent', type: 'address' }],
    name: 'getReputation',
    outputs: [
      { internalType: 'uint256', name: 'score', type: 'uint256' },
      { internalType: 'uint256', name: 'reviewCount', type: 'uint256' },
      { internalType: 'uint256', name: 'successfulDeals', type: 'uint256' },
      { internalType: 'uint256', name: 'failedDeals', type: 'uint256' },
      { internalType: 'uint256', name: 'avgScore', type: 'uint256' },
      { internalType: 'bool', name: 'exists', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export const PAYMENT_ROUTER_ABI = [
  {
    inputs: [
      { internalType: 'address', name: '_treasury', type: 'address' },
      { internalType: 'address', name: '_usdc', type: 'address' },
      { internalType: 'uint256', name: '_feePercent', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
    type: 'constructor',
  },
  {
    inputs: [
      { internalType: 'address', name: '_token', type: 'address' },
      { internalType: 'uint256', name: '_amount', type: 'uint256' },
    ],
    name: 'deposit',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: '_to', type: 'address' },
      { internalType: 'uint256', name: '_amount', type: 'uint256' },
      { internalType: 'address', name: '_token', type: 'address' },
      { internalType: 'bytes32', name: '_intentId', type: 'bytes32' },
      { internalType: 'uint256', name: '_escrowDuration', type: 'uint256' },
    ],
    name: 'createPayment',
    outputs: [{ internalType: 'bytes32', name: '', type: 'bytes32' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'bytes32', name: '_paymentId', type: 'bytes32' },
      { internalType: 'uint256', name: '_nonce', type: 'uint256' },
      { internalType: 'uint256', name: '_deadline', type: 'uint256' },
    ],
    name: 'executePayment',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: '_user', type: 'address' },
      { internalType: 'address', name: '_token', type: 'address' },
    ],
    name: 'getBalance',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'platformFeePercent',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export const ERC20_ABI = [
  {
    inputs: [
      { internalType: 'address', name: 'spender', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;
