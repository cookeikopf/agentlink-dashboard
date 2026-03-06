// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title PaymentRouter
 * @notice Secure payment routing system for AgentLink A2A network
 * @dev Handles USDC payments between agents with escrow and fee management
 * @security ReentrancyGuard, AccessControl, Pausable, SafeERC20
 * @audit Professional Security Review 2026-03-07
 *      - Fixed: C-003 (Unchecked return value)
 *      - Fixed: H-001 (Front-running with deadline)
 *      - Fixed: H-005 (Replay protection with nonce)
 *      - Fixed: M-001 (Floating pragma)
 */

contract PaymentRouter is ReentrancyGuard, AccessControl, Pausable {
    using SafeERC20 for IERC20;
    
    // Roles
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant AGENT_ROLE = keccak256("AGENT_ROLE");
    
    // Payment struct
    struct Payment {
        address from;
        address to;
        uint256 amount;
        address token;
        bytes32 intentId;
        uint256 fee;
        uint256 createdAt;
        uint256 expiresAt;
        bool executed;
        bool refunded;
        bool exists;
    }
    
    // Escrow struct
    struct Escrow {
        address client;
        address agent;
        uint256 amount;
        address token;
        uint256 milestoneId;
        bool released;
        bool disputed;
        bool exists;
    }
    
    // State variables
    mapping(bytes32 => Payment) public payments;
    mapping(bytes32 => Escrow) public escrows;
    mapping(address => bool) public supportedTokens;
    mapping(address => mapping(address => uint256)) public balances;
    
    // H-005: Nonce tracking for replay protection
    mapping(address => uint256) public nonces;
    
    bytes32[] public paymentIds;
    bytes32[] public escrowIds;
    
    // Config
    uint256 public platformFeePercent;
    uint256 public constant MAX_FEE_PERCENT = 1000; // 10% max
    uint256 public constant MIN_PAYMENT = 100000; // 0.1 USDC minimum
    uint256 public constant MAX_PAYMENT = 1000000000000; // 1M USDC max
    uint256 public constant DEFAULT_EXPIRY = 1 hours;
    uint256 public constant MAX_BATCH_SIZE = 50;
    uint256 public constant MAX_DEADLINE_WINDOW = 1 hours; // H-001
    
    address public treasury;
    address public agentReputation;
    
    // ============ Events ============
    
    event PaymentCreated(
        bytes32 indexed paymentId,
        address indexed from,
        address indexed to,
        uint256 amount,
        address token,
        bytes32 intentId,
        uint256 fee
    );
    
    event PaymentExecuted(
        bytes32 indexed paymentId,
        address indexed from,
        address indexed to,
        uint256 amount,
        uint256 fee,
        uint256 nonce // Added for tracking
    );
    
    event PaymentRefunded(
        bytes32 indexed paymentId,
        address indexed to,
        uint256 amount
    );
    
    event PaymentExpired(
        bytes32 indexed paymentId,
        address indexed from,
        uint256 amount
    );
    
    event EscrowCreated(
        bytes32 indexed escrowId,
        address indexed client,
        address indexed agent,
        uint256 amount,
        address token
    );
    
    event EscrowReleased(
        bytes32 indexed escrowId,
        address indexed agent,
        uint256 amount,
        uint256 fee
    );
    
    event EscrowDisputed(
        bytes32 indexed escrowId,
        address indexed client,
        string reason
    );
    
    event EscrowResolved(
        bytes32 indexed escrowId,
        address winner,
        uint256 amount
    );
    
    event Deposit(
        address indexed user,
        address indexed token,
        uint256 amount
    );
    
    event Withdrawal(
        address indexed user,
        address indexed token,
        uint256 amount
    );
    
    event TokenAdded(address indexed token);
    event TokenRemoved(address indexed token);
    event FeeUpdated(uint256 oldFee, uint256 newFee);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event ReputationContractUpdated(address indexed oldRep, address indexed newRep);
    event ReputationUpdateFailed(address indexed agent, string reason); // C-003
    event NonceUsed(address indexed user, uint256 nonce); // H-005
    
    // ============ Modifiers ============
    
    modifier validAddress(address _addr) {
        require(_addr != address(0), "Invalid address: zero address");
        require(_addr != address(this), "Invalid address: contract address");
        _;
    }
    
    modifier validAmount(uint256 _amount) {
        require(_amount >= MIN_PAYMENT, "Amount below minimum");
        require(_amount <= MAX_PAYMENT, "Amount above maximum");
        _;
    }
    
    modifier validToken(address _token) {
        require(supportedTokens[_token], "Token not supported");
        _;
    }
    
    modifier paymentExists(bytes32 _paymentId) {
        require(payments[_paymentId].exists, "Payment does not exist");
        _;
    }
    
    modifier escrowExists(bytes32 _escrowId) {
        require(escrows[_escrowId].exists, "Escrow does not exist");
        _;
    }
    
    // ============ Constructor ============
    
    constructor(
        address _treasury,
        address _usdc,
        uint256 _feePercent
    ) validAddress(_treasury) validAddress(_usdc) {
        require(_feePercent <= MAX_FEE_PERCENT, "Fee too high");
        
        treasury = _treasury;
        platformFeePercent = _feePercent;
        
        // Setup roles
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
        
        // Add USDC as supported token
        supportedTokens[_usdc] = true;
        
        emit TokenAdded(_usdc);
        emit TreasuryUpdated(address(0), _treasury);
        emit FeeUpdated(0, _feePercent);
    }
    
    // ============ Admin Functions ============
    
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }
    
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
    
    function setTreasury(address _newTreasury) 
        external 
        onlyRole(ADMIN_ROLE) 
        validAddress(_newTreasury) 
    {
        address oldTreasury = treasury;
        treasury = _newTreasury;
        emit TreasuryUpdated(oldTreasury, _newTreasury);
    }
    
    function setAgentReputation(address _reputation) 
        external 
        onlyRole(ADMIN_ROLE) 
        validAddress(_reputation) 
    {
        address oldRep = agentReputation;
        agentReputation = _reputation;
        emit ReputationContractUpdated(oldRep, _reputation);
    }
    
    function setFeePercent(uint256 _newFee) external onlyRole(ADMIN_ROLE) {
        require(_newFee <= MAX_FEE_PERCENT, "Fee exceeds maximum");
        uint256 oldFee = platformFeePercent;
        platformFeePercent = _newFee;
        emit FeeUpdated(oldFee, _newFee);
    }
    
    function addSupportedToken(address _token) 
        external 
        onlyRole(ADMIN_ROLE) 
        validAddress(_token) 
    {
        supportedTokens[_token] = true;
        emit TokenAdded(_token);
    }
    
    function removeSupportedToken(address _token) 
        external 
        onlyRole(ADMIN_ROLE) 
        validAddress(_token) 
    {
        supportedTokens[_token] = false;
        emit TokenRemoved(_token);
    }
    
    function addOperator(address _operator) 
        external 
        onlyRole(ADMIN_ROLE) 
        validAddress(_operator) 
    {
        _grantRole(OPERATOR_ROLE, _operator);
    }
    
    function removeOperator(address _operator) 
        external 
        onlyRole(ADMIN_ROLE) 
        validAddress(_operator) 
    {
        _revokeRole(OPERATOR_ROLE, _operator);
    }
    
    function addAgent(address _agent) 
        external 
        onlyRole(OPERATOR_ROLE) 
        validAddress(_agent) 
    {
        _grantRole(AGENT_ROLE, _agent);
    }
    
    function removeAgent(address _agent) 
        external 
        onlyRole(OPERATOR_ROLE) 
        validAddress(_agent) 
    {
        _revokeRole(AGENT_ROLE, _agent);
    }
    
    // ============ Deposit / Withdrawal ============
    
    function deposit(address _token, uint256 _amount) 
        external 
        validToken(_token)
        validAmount(_amount)
        whenNotPaused
        nonReentrant 
    {
        require(_amount > 0, "Amount must be greater than 0");
        
        IERC20 token = IERC20(_token);
        uint256 balanceBefore = token.balanceOf(address(this));
        
        token.safeTransferFrom(msg.sender, address(this), _amount);
        
        uint256 balanceAfter = token.balanceOf(address(this));
        require(balanceAfter >= balanceBefore + _amount, "Transfer failed");
        
        balances[msg.sender][_token] += _amount;
        
        emit Deposit(msg.sender, _token, _amount);
    }
    
    function withdraw(address _token, uint256 _amount) 
        external
        validToken(_token)
        whenNotPaused
        nonReentrant 
    {
        require(_amount > 0, "Amount must be greater than 0");
        require(balances[msg.sender][_token] >= _amount, "Insufficient balance");
        
        // Effects first
        balances[msg.sender][_token] -= _amount;
        
        // Then interaction
        IERC20(_token).safeTransfer(msg.sender, _amount);
        
        emit Withdrawal(msg.sender, _token, _amount);
    }
    
    // ============ Payment Functions ============
    
    function createPayment(
        address _to,
        uint256 _amount,
        address _token,
        bytes32 _intentId,
        uint256 _expiresIn
    ) 
        external
        validAddress(_to)
        validToken(_token)
        validAmount(_amount)
        whenNotPaused
        returns (bytes32 paymentId)
    {
        require(_to != msg.sender, "Cannot pay yourself");
        require(_intentId != bytes32(0), "Invalid intent ID");
        require(balances[msg.sender][_token] >= _amount, "Insufficient balance");
        
        // Calculate fee
        uint256 fee = (_amount * platformFeePercent) / 10000;
        uint256 netAmount = _amount - fee;
        
        // Create unique payment ID
        paymentId = keccak256(abi.encodePacked(
            msg.sender,
            _to,
            _amount,
            _token,
            _intentId,
            block.timestamp,
            block.number
        ));
        
        require(!payments[paymentId].exists, "Payment already exists");
        
        uint256 expiry = _expiresIn > 0 ? _expiresIn : DEFAULT_EXPIRY;
        
        // Store payment
        payments[paymentId] = Payment({
            from: msg.sender,
            to: _to,
            amount: netAmount,
            token: _token,
            intentId: _intentId,
            fee: fee,
            createdAt: block.timestamp,
            expiresAt: block.timestamp + expiry,
            executed: false,
            refunded: false,
            exists: true
        });
        
        paymentIds.push(paymentId);
        
        // Lock funds
        balances[msg.sender][_token] -= _amount;
        
        emit PaymentCreated(
            paymentId,
            msg.sender,
            _to,
            netAmount,
            _token,
            _intentId,
            fee
        );
        
        return paymentId;
    }
    
    // H-001: Added deadline for front-running protection
    // H-005: Added nonce for replay protection
    function executePayment(bytes32 _paymentId, uint256 _nonce, uint256 _deadline)
        external
        paymentExists(_paymentId)
        whenNotPaused
        nonReentrant
    {
        // H-001: Front-running protection with deadline
        require(block.timestamp <= _deadline, "Transaction expired");
        require(_deadline <= block.timestamp + MAX_DEADLINE_WINDOW, "Deadline too far");
        
        // H-005: Replay protection with nonce
        require(_nonce == nonces[msg.sender], "Invalid nonce");
        nonces[msg.sender]++;
        emit NonceUsed(msg.sender, _nonce);
        
        Payment storage payment = payments[_paymentId];
        
        require(!payment.executed, "Payment already executed");
        require(!payment.refunded, "Payment already refunded");
        require(block.timestamp <= payment.expiresAt, "Payment expired");
        require(
            msg.sender == payment.to || hasRole(OPERATOR_ROLE, msg.sender),
            "Not authorized"
        );
        
        // Effects first
        payment.executed = true;
        
        // C-003: Check return value or emit event on failure
        if (agentReputation != address(0)) {
            (bool success, ) = agentReputation.call(
                abi.encodeWithSignature(
                    "updateReputation(address,bool,uint256)",
                    payment.to,
                    true,
                    50
                )
            );
            if (!success) {
                emit ReputationUpdateFailed(payment.to, "executePayment");
            }
        }
        
        // Interactions last
        if (payment.fee > 0) {
            IERC20(payment.token).safeTransfer(treasury, payment.fee);
        }
        
        IERC20(payment.token).safeTransfer(payment.to, payment.amount);
        
        emit PaymentExecuted(
            _paymentId,
            payment.from,
            payment.to,
            payment.amount,
            payment.fee,
            _nonce // Include nonce in event
        );
    }
    
    function refundPayment(bytes32 _paymentId)
        external
        paymentExists(_paymentId)
        whenNotPaused
        nonReentrant
    {
        Payment storage payment = payments[_paymentId];
        
        require(!payment.executed, "Payment already executed");
        require(!payment.refunded, "Payment already refunded");
        require(
            msg.sender == payment.from || hasRole(OPERATOR_ROLE, msg.sender),
            "Not authorized"
        );
        
        // Effects first
        payment.refunded = true;
        
        uint256 totalAmount = payment.amount + payment.fee;
        
        // Then interaction
        balances[payment.from][payment.token] += totalAmount;
        
        emit PaymentRefunded(_paymentId, payment.from, totalAmount);
    }
    
    function processExpiredPayment(bytes32 _paymentId)
        external
        paymentExists(_paymentId)
        whenNotPaused
        nonReentrant
    {
        Payment storage payment = payments[_paymentId];
        
        require(!payment.executed, "Payment already executed");
        require(!payment.refunded, "Payment already refunded");
        require(block.timestamp > payment.expiresAt, "Payment not expired");
        
        // Effects first
        payment.refunded = true;
        
        uint256 totalAmount = payment.amount + payment.fee;
        
        // Then interaction
        balances[payment.from][payment.token] += totalAmount;
        
        emit PaymentExpired(_paymentId, payment.from, totalAmount);
    }
    
    // ============ Escrow Functions ============
    
    function createEscrow(
        address _agent,
        uint256 _amount,
        address _token,
        uint256 _milestoneId
    ) 
        external
        validAddress(_agent)
        validToken(_token)
        validAmount(_amount)
        whenNotPaused
        returns (bytes32 escrowId)
    {
        require(_agent != msg.sender, "Cannot escrow to yourself");
        require(hasRole(AGENT_ROLE, _agent), "Recipient is not a registered agent");
        require(balances[msg.sender][_token] >= _amount, "Insufficient balance");
        
        escrowId = keccak256(abi.encodePacked(
            msg.sender,
            _agent,
            _amount,
            _token,
            _milestoneId,
            block.timestamp,
            block.number
        ));
        
        require(!escrows[escrowId].exists, "Escrow already exists");
        
        escrows[escrowId] = Escrow({
            client: msg.sender,
            agent: _agent,
            amount: _amount,
            token: _token,
            milestoneId: _milestoneId,
            released: false,
            disputed: false,
            exists: true
        });
        
        escrowIds.push(escrowId);
        
        // Lock funds
        balances[msg.sender][_token] -= _amount;
        
        emit EscrowCreated(escrowId, msg.sender, _agent, _amount, _token);
    }
    
    function releaseEscrow(bytes32 _escrowId)
        external
        escrowExists(_escrowId)
        whenNotPaused
        nonReentrant
    {
        Escrow storage escrow = escrows[_escrowId];
        
        require(!escrow.released, "Escrow already released");
        require(!escrow.disputed, "Escrow is disputed");
        require(
            msg.sender == escrow.client || hasRole(OPERATOR_ROLE, msg.sender),
            "Not authorized"
        );
        
        // Calculate fee
        uint256 fee = (escrow.amount * platformFeePercent) / 10000;
        uint256 netAmount = escrow.amount - fee;
        
        // Effects first
        escrow.released = true;
        
        // C-003: Check return value
        if (agentReputation != address(0)) {
            (bool success, ) = agentReputation.call(
                abi.encodeWithSignature(
                    "updateReputation(address,bool,uint256)",
                    escrow.agent,
                    true,
                    50
                )
            );
            if (!success) {
                emit ReputationUpdateFailed(escrow.agent, "releaseEscrow");
            }
        }
        
        // Interactions last
        if (fee > 0) {
            IERC20(escrow.token).safeTransfer(treasury, fee);
        }
        
        IERC20(escrow.token).safeTransfer(escrow.agent, netAmount);
        
        emit EscrowReleased(_escrowId, escrow.agent, netAmount, fee);
    }
    
    function disputeEscrow(bytes32 _escrowId, string calldata _reason)
        external
        escrowExists(_escrowId)
        whenNotPaused
    {
        Escrow storage escrow = escrows[_escrowId];
        
        require(!escrow.released, "Escrow already released");
        require(!escrow.disputed, "Escrow already disputed");
        require(
            msg.sender == escrow.client || msg.sender == escrow.agent,
            "Not authorized"
        );
        require(bytes(_reason).length > 0, "Reason required");
        require(bytes(_reason).length <= 500, "Reason too long");
        
        escrow.disputed = true;
        
        emit EscrowDisputed(_escrowId, msg.sender, _reason);
    }
    
    function resolveDispute(
        bytes32 _escrowId,
        address _winner,
        uint256 _winnerAmount
    ) 
        external
        onlyRole(OPERATOR_ROLE)
        escrowExists(_escrowId)
        validAddress(_winner)
        whenNotPaused
        nonReentrant
    {
        Escrow storage escrow = escrows[_escrowId];
        
        require(escrow.disputed, "Escrow not disputed");
        require(!escrow.released, "Escrow already released");
        require(
            _winner == escrow.client || _winner == escrow.agent,
            "Invalid winner"
        );
        require(_winnerAmount <= escrow.amount, "Amount exceeds escrow");
        
        // Effects first
        escrow.released = true;
        
        uint256 loserAmount = escrow.amount - _winnerAmount;
        address loser = _winner == escrow.client ? escrow.agent : escrow.client;
        
        // C-003: Check return value
        if (agentReputation != address(0)) {
            (bool success, ) = agentReputation.call(
                abi.encodeWithSignature(
                    "updateReputation(address,bool,uint256)",
                    _winner,
                    true,
                    30
                )
            );
            if (!success) {
                emit ReputationUpdateFailed(_winner, "resolveDispute-winner");
            }
            
            if (loserAmount == 0) {
                (success, ) = agentReputation.call(
                    abi.encodeWithSignature(
                        "updateReputation(address,bool,uint256)",
                        loser,
                        false,
                        0
                    )
                );
                if (!success) {
                    emit ReputationUpdateFailed(loser, "resolveDispute-loser");
                }
            }
        }
        
        // Interactions
        if (_winnerAmount > 0) {
            IERC20(escrow.token).safeTransfer(_winner, _winnerAmount);
        }
        
        if (loserAmount > 0) {
            IERC20(escrow.token).safeTransfer(loser, loserAmount);
        }
        
        emit EscrowResolved(_escrowId, _winner, _winnerAmount);
    }
    
    // ============ Batch Operations ============
    
    function batchProcessExpired(bytes32[] calldata _paymentIds)
        external
        whenNotPaused
        nonReentrant
    {
        require(_paymentIds.length <= MAX_BATCH_SIZE, "Batch too large");
        
        for (uint256 i = 0; i < _paymentIds.length; i++) {
            bytes32 pid = _paymentIds[i];
            Payment storage payment = payments[pid];
            
            if (
                payment.exists &&
                !payment.executed &&
                !payment.refunded &&
                block.timestamp > payment.expiresAt
            ) {
                payment.refunded = true;
                uint256 totalAmount = payment.amount + payment.fee;
                balances[payment.from][payment.token] += totalAmount;
                emit PaymentExpired(pid, payment.from, totalAmount);
            }
        }
    }
    
    // ============ View Functions ============
    
    function getPayment(bytes32 _paymentId)
        external
        view
        paymentExists(_paymentId)
        returns (Payment memory)
    {
        return payments[_paymentId];
    }
    
    function getEscrow(bytes32 _escrowId)
        external
        view
        escrowExists(_escrowId)
        returns (Escrow memory)
    {
        return escrows[_escrowId];
    }
    
    function getBalance(address _user, address _token)
        external
        view
        returns (uint256)
    {
        return balances[_user][_token];
    }
    
    function calculateFee(uint256 _amount)
        external
        view
        returns (uint256 fee, uint256 netAmount)
    {
        fee = (_amount * platformFeePercent) / 10000;
        netAmount = _amount - fee;
    }
    
    function isTokenSupported(address _token) external view returns (bool) {
        return supportedTokens[_token];
    }
    
    function getPaymentCount() external view returns (uint256) {
        return paymentIds.length;
    }
    
    function getEscrowCount() external view returns (uint256) {
        return escrowIds.length;
    }
    
    // ============ Emergency Functions ============
    
    function emergencyWithdrawTokens(
        address _token,
        address _recipient,
        uint256 _amount
    ) 
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
        validAddress(_recipient)
        validToken(_token)
        nonReentrant
    {
        require(_amount > 0, "Amount must be greater than 0");
        IERC20(_token).safeTransfer(_recipient, _amount);
    }
    
    function emergencyWithdrawETH(address _recipient)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
        validAddress(_recipient)
        nonReentrant
    {
        uint256 balance = address(this).balance;
        require(balance > 0, "No ETH to withdraw");
        
        (bool success, ) = payable(_recipient).call{value: balance}("");
        require(success, "Transfer failed");
    }
    
    receive() external payable {
        // Accept ETH but don't do anything
        // Should not receive ETH normally
    }
}
