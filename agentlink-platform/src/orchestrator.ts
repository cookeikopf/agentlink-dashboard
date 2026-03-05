/**
 * AgentLink Task Orchestrator
 * 
 * Meta-Agent der Sub-Agenten koordiniert
 * Monetarisierung: Per-Workflow Fee
 */

import EventEmitter from 'events';

// Workflow Definition
export interface Workflow {
  id: string;
  name: string;
  description: string;
  owner: `0x${string}`;
  status: WorkflowStatus;
  steps: WorkflowStep[];
  currentStep: number;
  totalBudget: bigint;
  spentBudget: bigint;
  createdAt: number;
  completedAt?: number;
}

export type WorkflowStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed';

export interface WorkflowStep {
  id: string;
  type: AgentType;
  agent?: `0x${string}`; // Assigned agent
  input: any;
  output?: any;
  status: StepStatus;
  fee: bigint;
  startedAt?: number;
  completedAt?: number;
  error?: string;
}

export type StepStatus = 'pending' | 'assigned' | 'running' | 'completed' | 'failed';

export type AgentType = 
  | 'debugger'
  | 'auditor'
  | 'tester'
  | 'reviewer'
  | 'deployer'
  | 'optimizer'
  | 'orchestrator';

// Sub-Agenten Konfiguration
export interface SubAgent {
  address: `0x${string}`;
  type: AgentType;
  name: string;
  description: string;
  skills: string[];
  pricing: {
    perTask: bigint;
    perHour?: bigint;
  };
  rating: number;
  availability: 'available' | 'busy' | 'offline';
}

export class TaskOrchestrator extends EventEmitter {
  private workflows: Map<string, Workflow> = new Map();
  private subAgents: Map<AgentType, SubAgent[]> = new Map();
  private activeJobs: Map<string, { workflow: string; step: string }> = new Map();
  
  // Fee Configuration
  private readonly WORKFLOW_FEE = 500000n; // 0.5 USDC per workflow
  private readonly ORCHESTRATOR_FEE_PERCENT = 10; // 10% of total
  
  constructor() {
    super();
    this.initializeDefaultAgents();
  }
  
  /**
   * Initialisiert Standard Sub-Agenten
   */
  private initializeDefaultAgents() {
    const defaultAgents: SubAgent[] = [
      {
        address: '0xDebugger0000000000000000000000000000000001',
        type: 'debugger',
        name: 'Debug Master',
        description: 'Advanced debugging with stack trace analysis',
        skills: ['error-analysis', 'stack-trace', 'log-parsing'],
        pricing: { perTask: 2000000n }, // 2 USDC
        rating: 4.8,
        availability: 'available'
      },
      {
        address: '0xAuditor00000000000000000000000000000000002',
        type: 'auditor',
        name: 'Security Guardian',
        description: 'Smart contract security audit',
        skills: ['solidity', 'vulnerability-detection', 'best-practices'],
        pricing: { perTask: 5000000n }, // 5 USDC
        rating: 4.9,
        availability: 'available'
      },
      {
        address: '0xTester000000000000000000000000000000000003',
        type: 'tester',
        name: 'TDD Expert',
        description: 'Test-driven development specialist',
        skills: ['unit-tests', 'integration-tests', 'coverage'],
        pricing: { perTask: 1500000n }, // 1.5 USDC
        rating: 4.7,
        availability: 'available'
      },
      {
        address: '0xReviewer0000000000000000000000000000000004',
        type: 'reviewer',
        name: 'Code Reviewer Pro',
        description: 'Comprehensive code review',
        skills: ['readability', 'performance', 'patterns'],
        pricing: { perTask: 1000000n }, // 1 USDC
        rating: 4.6,
        availability: 'available'
      },
      {
        address: '0xDeployer000000000000000000000000000000005',
        type: 'deployer',
        name: 'Deploy Bot',
        description: 'Safe contract deployment',
        skills: ['deployment', 'verification', 'monitoring'],
        pricing: { perTask: 1000000n }, // 1 USDC
        rating: 4.8,
        availability: 'available'
      }
    ];
    
    defaultAgents.forEach(agent => {
      const list = this.subAgents.get(agent.type) || [];
      list.push(agent);
      this.subAgents.set(agent.type, list);
    });
  }
  
  /**
   * Erstellt neuen Workflow
   */
  async createWorkflow(
    owner: `0x${string}`,
    name: string,
    description: string,
    steps: { type: AgentType; input: any }[],
    budget: bigint
  ): Promise<{ workflow: Workflow; invoice: WorkflowInvoice }> {
    // Calculate fees
    const orchestratorFee = (budget * BigInt(this.ORCHESTRATOR_FEE_PERCENT)) / 100n;
    const totalCost = budget + orchestratorFee + this.WORKFLOW_FEE;
    
    const workflowSteps: WorkflowStep[] = steps.map((step, index) => ({
      id: `step-${Date.now()}-${index}`,
      type: step.type,
      input: step.input,
      status: 'pending',
      fee: budget / BigInt(steps.length)
    }));
    
    const workflow: Workflow = {
      id: `wf-${Date.now()}`,
      name,
      description,
      owner,
      status: 'pending',
      steps: workflowSteps,
      currentStep: 0,
      totalBudget: budget,
      spentBudget: 0n,
      createdAt: Date.now()
    };
    
    this.workflows.set(workflow.id, workflow);
    
    const invoice: WorkflowInvoice = {
      id: `inv-${Date.now()}`,
      workflowId: workflow.id,
      amount: totalCost,
      breakdown: {
        workflowFee: this.WORKFLOW_FEE,
        orchestratorFee,
        agentBudget: budget
      },
      status: 'pending'
    };
    
    this.emit('workflowCreated', workflow, invoice);
    
    return { workflow, invoice };
  }
  
  /**
   * Startet Workflow Execution
   */
  async startWorkflow(workflowId: string): Promise<void> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) throw new Error('Workflow not found');
    if (workflow.status !== 'pending') throw new Error('Workflow already started');
    
    workflow.status = 'running';
    this.emit('workflowStarted', workflow);
    
    // Start first step
    await this.executeStep(workflowId, 0);
  }
  
  /**
   * Führt Workflow Step aus
   */
  private async executeStep(workflowId: string, stepIndex: number): Promise<void> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return;
    
    const step = workflow.steps[stepIndex];
    if (!step) {
      // All steps completed
      await this.completeWorkflow(workflowId);
      return;
    }
    
    workflow.currentStep = stepIndex;
    step.status = 'assigned';
    step.startedAt = Date.now();
    
    // Find available agent
    const agent = await this.findAgent(step.type);
    if (!agent) {
      step.status = 'failed';
      step.error = 'No agent available';
      await this.failWorkflow(workflowId, 'No agent available for step');
      return;
    }
    
    step.agent = agent.address;
    step.status = 'running';
    
    this.emit('stepStarted', workflow, step, agent);
    
    // Simulate execution (in production: call agent via A2A)
    try {
      const result = await this.callAgent(agent, step.input);
      
      step.output = result;
      step.status = 'completed';
      step.completedAt = Date.now();
      workflow.spentBudget += step.fee;
      
      this.emit('stepCompleted', workflow, step, agent);
      
      // Move to next step
      await this.executeStep(workflowId, stepIndex + 1);
      
    } catch (error: any) {
      step.status = 'failed';
      step.error = error.message;
      await this.failWorkflow(workflowId, error.message);
    }
  }
  
  /**
   * Findet besten verfügbaren Agenten
   */
  private async findAgent(type: AgentType): Promise<SubAgent | null> {
    const agents = this.subAgents.get(type) || [];
    const available = agents.filter(a => a.availability === 'available');
    
    if (available.length === 0) return null;
    
    // Sort by rating (descending)
    available.sort((a, b) => b.rating - a.rating);
    
    return available[0];
  }
  
  /**
   * Ruft Agent auf (simulated)
   */
  private async callAgent(agent: SubAgent, input: any): Promise<any> {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Mock response based on agent type
    switch (agent.type) {
      case 'debugger':
        return {
          errorFound: true,
          errorType: 'NullPointerException',
          line: 42,
          suggestion: 'Add null check'
        };
      case 'auditor':
        return {
          vulnerabilities: [
            { severity: 'high', issue: 'Reentrancy', line: 25 },
            { severity: 'medium', issue: 'Unchecked return', line: 30 }
          ],
          score: 75
        };
      case 'tester':
        return {
          testsCreated: 15,
          coverage: 85,
          passed: 14,
          failed: 1
        };
      case 'reviewer':
        return {
          readability: 8,
          performance: 7,
          suggestions: ['Extract method', 'Add comments']
        };
      case 'deployer':
        return {
          deployed: true,
          address: '0xNewContract' + Math.random().toString(36).slice(2, 10),
          gasUsed: 250000
        };
      default:
        return { success: true };
    }
  }
  
  /**
   * Vervollständigt Workflow
   */
  private async completeWorkflow(workflowId: string): Promise<void> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return;
    
    workflow.status = 'completed';
    workflow.completedAt = Date.now();
    
    this.emit('workflowCompleted', workflow);
  }
  
  /**
   * Markiert Workflow als failed
   */
  private async failWorkflow(workflowId: string, reason: string): Promise<void> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return;
    
    workflow.status = 'failed';
    
    this.emit('workflowFailed', workflow, reason);
  }
  
  /**
   * Pausiert Workflow
   */
  pauseWorkflow(workflowId: string): void {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) throw new Error('Workflow not found');
    if (workflow.status !== 'running') throw new Error('Workflow not running');
    
    workflow.status = 'paused';
    this.emit('workflowPaused', workflow);
  }
  
  /**
   * Setzt Workflow fort
   */
  resumeWorkflow(workflowId: string): void {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) throw new Error('Workflow not found');
    if (workflow.status !== 'paused') throw new Error('Workflow not paused');
    
    workflow.status = 'running';
    this.emit('workflowResumed', workflow);
    
    // Continue from current step
    this.executeStep(workflowId, workflow.currentStep);
  }
  
  /**
   * Fügt Sub-Agent hinzu
   */
  registerAgent(agent: SubAgent): void {
    const list = this.subAgents.get(agent.type) || [];
    list.push(agent);
    this.subAgents.set(agent.type, list);
    
    this.emit('agentRegistered', agent);
  }
  
  /**
   * Holt Workflow Details
   */
  getWorkflow(workflowId: string): Workflow | undefined {
    return this.workflows.get(workflowId);
  }
  
  /**
   * Holt alle Workflows eines Owners
   */
  getWorkflowsByOwner(owner: `0x${string}`): Workflow[] {
    return Array.from(this.workflows.values())
      .filter(w => w.owner.toLowerCase() === owner.toLowerCase());
  }
  
  /**
   * Statistiken
   */
  getStats(): {
    totalWorkflows: number;
    completedWorkflows: number;
    failedWorkflows: number;
    totalRevenue: bigint;
    activeAgents: number;
  } {
    const workflows = Array.from(this.workflows.values());
    const agents = Array.from(this.subAgents.values()).flat();
    
    let revenue = 0n;
    workflows.forEach(w => {
      revenue += this.WORKFLOW_FEE;
      revenue += (w.spentBudget * BigInt(this.ORCHESTRATOR_FEE_PERCENT)) / 100n;
    });
    
    return {
      totalWorkflows: workflows.length,
      completedWorkflows: workflows.filter(w => w.status === 'completed').length,
      failedWorkflows: workflows.filter(w => w.status === 'failed').length,
      totalRevenue: revenue,
      activeAgents: agents.length
    };
  }
}

export interface WorkflowInvoice {
  id: string;
  workflowId: string;
  amount: bigint;
  breakdown: {
    workflowFee: bigint;
    orchestratorFee: bigint;
    agentBudget: bigint;
  };
  status: 'pending' | 'paid' | 'expired';
}

export default TaskOrchestrator;
