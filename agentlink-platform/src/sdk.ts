/**
 * AgentLink SDK
 * 
 * SDK für Cursor.dev / Claude Code Integration
 * Ermöglicht x402-Paywalls und Multi-Agent Workflows
 */

import EventEmitter from 'events';

// SDK Configuration
export interface SDKConfig {
  apiKey: string;
  baseUrl?: string;
  network?: 'base-sepolia' | 'base-mainnet';
  wallet?: {
    privateKey?: string;
    address?: `0x${string}`;
  };
}

// Agent Types
export interface Agent {
  address: `0x${string}`;
  name: string;
  description: string;
  skills: string[];
  pricing: {
    perTask: bigint;
    currency: string;
  };
  reputation: {
    overall: number;
    completedJobs: number;
  };
  availability: 'available' | 'busy' | 'offline';
}

// Task Definition
export interface Task {
  id: string;
  type: string;
  description: string;
  input: any;
  budget: {
    min: bigint;
    max: bigint;
  };
  deadline?: number;
  requirements?: string[];
}

// Workflow Definition
export interface Workflow {
  id: string;
  name: string;
  steps: WorkflowStep[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  totalCost: bigint;
}

export interface WorkflowStep {
  id: string;
  type: string;
  agent?: Agent;
  input: any;
  output?: any;
  cost?: bigint;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

// API Response with x402
export interface APIResponse<T> {
  data?: T;
  error?: string;
  paymentRequired?: {
    amount: bigint;
    token: string;
    network: string;
  };
}

export class AgentLinkSDK extends EventEmitter {
  private config: SDKConfig;
  private baseUrl: string;
  private headers: Record<string, string>;
  
  constructor(config: SDKConfig) {
    super();
    this.config = config;
    this.baseUrl = config.baseUrl || 'https://api.agentlink.io/v1';
    this.headers = {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json'
    };
  }
  
  // ═══════════════════════════════════════════════════════════
  // AGENT MANAGEMENT
  // ═══════════════════════════════════════════════════════════
  
  /**
   * Erstellt neuen Agenten
   */
  async createAgent(agentData: {
    name: string;
    description: string;
    skills: string[];
    pricing: { perTask: bigint };
  }): Promise<APIResponse<Agent>> {
    const response = await this.fetch('/agents', {
      method: 'POST',
      body: JSON.stringify(agentData)
    });
    
    if (response.status === 402) {
      // Payment required
      const paymentInfo = await response.json();
      return {
        error: 'Payment required',
        paymentRequired: {
          amount: BigInt(paymentInfo.amount),
          token: paymentInfo.token,
          network: paymentInfo.network
        }
      };
    }
    
    const data = await response.json();
    return { data };
  }
  
  /**
   * Sucht Agenten
   */
  async findAgents(filters: {
    skills?: string[];
    minReputation?: number;
    maxPrice?: bigint;
    availableOnly?: boolean;
  }): Promise<Agent[]> {
    const queryParams = new URLSearchParams();
    
    if (filters.skills) {
      filters.skills.forEach(s => queryParams.append('skill', s));
    }
    if (filters.minReputation) {
      queryParams.set('minReputation', filters.minReputation.toString());
    }
    if (filters.maxPrice) {
      queryParams.set('maxPrice', filters.maxPrice.toString());
    }
    if (filters.availableOnly) {
      queryParams.set('available', 'true');
    }
    
    const response = await this.fetch(`/agents?${queryParams}`);
    return response.json();
  }
  
  /**
   * Holt Agent Details
   */
  async getAgent(address: `0x${string}`): Promise<Agent> {
    const response = await this.fetch(`/agents/${address}`);
    return response.json();
  }
  
  // ═══════════════════════════════════════════════════════════
  // TASK MANAGEMENT
  // ═══════════════════════════════════════════════════════════
  
  /**
   * Postet neuen Task
   */
  async postTask(taskData: {
    type: string;
    description: string;
    input: any;
    budget: { min: bigint; max: bigint };
    deadline?: number;
  }): Promise<APIResponse<Task>> {
    const response = await this.fetch('/tasks', {
      method: 'POST',
      body: JSON.stringify({
        ...taskData,
        budget: {
          min: taskData.budget.min.toString(),
          max: taskData.budget.max.toString()
        }
      })
    });
    
    const data = await response.json();
    return { data };
  }
  
  /**
   * Findet besten Agenten für Task
   */
  async findBestAgent(
    taskId: string,
    criteria: 'price' | 'reputation' | 'speed' = 'reputation'
  ): Promise<APIResponse<Agent>> {
    const response = await this.fetch(`/tasks/${taskId}/match?criteria=${criteria}`);
    
    if (response.status === 402) {
      const paymentInfo = await response.json();
      return {
        error: 'Match fee required',
        paymentRequired: {
          amount: BigInt(paymentInfo.amount),
          token: paymentInfo.token,
          network: paymentInfo.network
        }
      };
    }
    
    const data = await response.json();
    return { data };
  }
  
  /**
   * Führt Task mit Agent aus
   */
  async execute(
    taskId: string,
    agentAddress: `0x${string}`
  ): Promise<APIResponse<{ result: any; invoice: any }>> {
    const response = await this.fetch(`/tasks/${taskId}/execute`, {
      method: 'POST',
      body: JSON.stringify({ agentAddress })
    });
    
    if (response.status === 402) {
      const paymentInfo = await response.json();
      return {
        error: 'Payment required',
        paymentRequired: {
          amount: BigInt(paymentInfo.amount),
          token: paymentInfo.token,
          network: paymentInfo.network
        }
      };
    }
    
    const data = await response.json();
    return { data };
  }
  
  /**
   * Bezahlt Invoice
   */
  async pay(invoiceId: string): Promise<{ success: boolean; txHash?: string }> {
    // In production: actual blockchain transaction
    // For now: mock payment
    return { success: true, txHash: '0x' + '0'.repeat(64) };
  }
  
  // ═══════════════════════════════════════════════════════════
  // WORKFLOW ORCHESTRATION
  // ═══════════════════════════════════════════════════════════
  
  /**
   * Erstellt Workflow
   */
  async createWorkflow(
    name: string,
    steps: { type: string; input: any }[],
    budget: bigint
  ): Promise<Workflow> {
    const response = await this.fetch('/workflows', {
      method: 'POST',
      body: JSON.stringify({
        name,
        steps,
        budget: budget.toString()
      })
    });
    
    return response.json();
  }
  
  /**
   * Startet Workflow
   */
  async startWorkflow(workflowId: string): Promise<void> {
    await this.fetch(`/workflows/${workflowId}/start`, {
      method: 'POST'
    });
  }
  
  /**
   * Holt Workflow Status
   */
  async getWorkflow(workflowId: string): Promise<Workflow> {
    const response = await this.fetch(`/workflows/${workflowId}`);
    return response.json();
  }
  
  /**
   * Erstellt Multi-Agent Workflow
   * 
   * Beispiel: Debug → Audit → Test → Deploy
   */
  async createDevWorkflow(
    code: string,
    budget: bigint
  ): Promise<Workflow> {
    const steps = [
      { type: 'debugger', input: { code } },
      { type: 'auditor', input: { code } },
      { type: 'tester', input: { code } },
      { type: 'deployer', input: { code } }
    ];
    
    return this.createWorkflow('Development Pipeline', steps, budget);
  }
  
  // ═══════════════════════════════════════════════════════════
  // API GATEWAY
  // ═══════════════════════════════════════════════════════════
  
  /**
   * Ruft API Endpoint auf (mit x402)
   */
  async callAPI(
    endpoint: string,
    params?: Record<string, any>
  ): Promise<APIResponse<any>> {
    const queryParams = params ? '?' + new URLSearchParams(params).toString() : '';
    
    const response = await this.fetch(`/api${endpoint}${queryParams}`);
    
    if (response.status === 402) {
      const paymentInfo = await response.json();
      
      // Auto-pay if wallet configured
      if (this.config.wallet?.privateKey) {
        // In production: sign and send transaction
        return this.callAPI(endpoint, params); // Retry after payment
      }
      
      return {
        error: 'Payment required',
        paymentRequired: {
          amount: BigInt(paymentInfo.price) * 1000000n, // Convert to USDC
          token: 'USDC',
          network: this.config.network || 'base-sepolia'
        }
      };
    }
    
    const data = await response.json();
    return { data };
  }
  
  /**
   * Holt verfügbare APIs
   */
  async getAvailableAPIs(): Promise<{ id: string; path: string; price: string }[]> {
    const response = await this.fetch('/api/endpoints');
    return response.json();
  }
  
  // ═══════════════════════════════════════════════════════════
  // ANALYTICS
  // ═══════════════════════════════════════════════════════════
  
  /**
   * Holt Platform Metrics
   */
  async getMetrics(): Promise<any> {
    const response = await this.fetch('/analytics/metrics');
    return response.json();
  }
  
  /**
   * Holt Insights
   */
  async getInsights(type?: string): Promise<any[]> {
    const url = type ? `/analytics/insights?type=${type}` : '/analytics/insights';
    const response = await this.fetch(url);
    return response.json();
  }
  
  // ═══════════════════════════════════════════════════════════
  // HELPER METHODS
  // ═══════════════════════════════════════════════════════════
  
  private async fetch(path: string, options?: RequestInit): Promise<Response> {
    const url = `${this.baseUrl}${path}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.headers,
        ...options?.headers
      }
    });
    
    return response;
  }
  
  /**
   * Konvertiert USDC zu BigInt (6 decimals)
   */
  static toUSDC(amount: number): bigint {
    return BigInt(Math.round(amount * 1_000_000));
  }
  
  /**
   * Konvertiert BigInt zu USDC
   */
  static fromUSDC(amount: bigint): number {
    return Number(amount) / 1_000_000;
  }
}

// ═══════════════════════════════════════════════════════════
// CLI INTEGRATION (für Cursor.dev / Claude Code)
// ═══════════════════════════════════════════════════════════

/**
 * CLI Commands für Cursor.dev Integration
 */
export const CLICOMMANDS = `
# AgentLink CLI Commands

## Agent Management
agentlink agent create --name "My Agent" --skills "coding,debugging"
agentlink agent list --skills "security" --min-reputation 80
agentlink agent get 0x...

## Task Management  
agentlink task create --type "audit" --budget 5 --input "./contract.sol"
agentlink task match <task-id> --criteria price
agentlink task execute <task-id> --agent 0x...

## Workflows
agentlink workflow create-dev --code "./src" --budget 20
agentlink workflow start <workflow-id>
agentlink workflow status <workflow-id>

## API Calls
agentlink api call /aave/rates
agentlink api call /weather/current --city "Berlin"
agentlink api list

## Analytics
agentlink analytics metrics
agentlink analytics insights
`;

export default AgentLinkSDK;
