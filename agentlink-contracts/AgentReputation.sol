// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title AgentReputation
 * @notice On-chain Reputation System für AgentLink A2A-Netzwerk
 * @dev Speichert Reputation-Scores für Agenten basierend auf Transaktionen
 * @security ReentrancyGuard, AccessControl, Pausable für maximale Sicherheit
 */

contract AgentReputation is ReentrancyGuard, AccessControl, Pausable {
    
    // Roles
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant UPDATER_ROLE = keccak256("UPDATER_ROLE");
    bytes32 public constant REVIEWER_ROLE = keccak256("REVIEWER_ROLE");
    
    struct Reputation {
        uint256 totalScore;        // Kumulierter Score (0-5000 für 0.0-5.0)
        uint256 reviewCount;       // Anzahl Reviews
        uint256 successfulDeals;   // Erfolgreiche Deals
        uint256 failedDeals;       // Fehlgeschlagene Deals
        uint256 lastUpdate;        // Letztes Update Timestamp
        bool exists;               // Existenz-Check für Validierung
    }
    
    struct Review {
        address reviewer;          // Wer hat reviewt
        uint256 score;            // 0-50 (0.0-5.0 mit 1 decimal)
        string comment;           // Optionaler Kommentar
        uint256 timestamp;        // Wann
        bytes32 dealId;          // Referenz zum Deal
        bool exists;             // Existenz-Check
    }
    
    // Agent Address => Reputation
    mapping(address => Reputation) public reputations;
    
    // Agent Address => Review Index => Review
    mapping(address => mapping(uint256 => Review)) public reviews;
    
    // Agent Address => Review Count
    mapping(address => uint256) public reviewCounts;
    
    // Minimum score für neue Agenten (neutral)
    uint256 public constant INITIAL_SCORE = 250; // 2.5/5.0
    uint256 public constant MAX_SCORE = 500;     // 5.0/5.0
    uint256 public constant MIN_SCORE = 0;       // 0.0/5.0
    uint256 public constant MAX_COMMENT_LENGTH = 500;
    uint256 public constant MAX_BATCH_SIZE = 100;
    
    // Treasury address for fees
    address public treasury;
    
    // Review fee (optional, can be 0)
    uint256 public reviewFee;
    
    // ============ Events ============
    
    event ReputationUpdated(
        address indexed agent,
        uint256 newScore,
        uint256 reviewCount,
        bool successful,
        address indexed updater
    );
    
    event ReviewAdded(
        address indexed agent,
        address indexed reviewer,
        uint256 score,
        bytes32 indexed dealId,
        uint256 reviewId
    );
    
    event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender);
    event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event ReviewFeeUpdated(uint256 oldFee, uint256 newFee);
    event ContractPaused(address indexed pauser);
    event ContractUnpaused(address indexed unpauser);
    event EmergencyWithdrawal(address indexed token, uint256 amount, address indexed recipient);
    
    // ============ Modifiers ============
    
    modifier validAddress(address _addr) {
        require(_addr != address(0), "Invalid address: zero address");
        require(_addr != address(this), "Invalid address: contract address");
        _;
    }
    
    modifier validScore(uint256 _score) {
        require(_score <= MAX_SCORE, "Invalid score: exceeds maximum");
        _;
    }
    
    modifier validComment(string calldata _comment) {
        require(bytes(_comment).length <= MAX_COMMENT_LENGTH, "Invalid comment: too long");
        _;
    }
    
    // ============ Constructor ============
    
    constructor(address _treasury) validAddress(_treasury) {
        require(_treasury != address(0), "Treasury cannot be zero address");
        
        treasury = _treasury;
        reviewFee = 0; // Default: no fee
        
        // Setup roles
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(UPDATER_ROLE, msg.sender);
        
        emit RoleGranted(ADMIN_ROLE, msg.sender, msg.sender);
        emit RoleGranted(UPDATER_ROLE, msg.sender, msg.sender);
    }
    
    // ============ Admin Functions ============
    
    /**
     * @notice Pausiert den Contract (Emergency)
     * @dev Nur ADMIN_ROLE kann pausieren
     */
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
        emit ContractPaused(msg.sender);
    }
    
    /**
     * @notice Entpausiert den Contract
     * @dev Nur ADMIN_ROLE kann entpausieren
     */
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
        emit ContractUnpaused(msg.sender);
    }
    
    /**
     * @notice Aktualisiert Treasury Adresse
     * @param _newTreasury Neue Treasury Adresse
     */
    function setTreasury(address _newTreasury) 
        external 
        onlyRole(ADMIN_ROLE) 
        validAddress(_newTreasury) 
    {
        address oldTreasury = treasury;
        treasury = _newTreasury;
        emit TreasuryUpdated(oldTreasury, _newTreasury);
    }
    
    /**
     * @notice Setzt Review Fee
     * @param _newFee Neue Fee in wei
     */
    function setReviewFee(uint256 _newFee) external onlyRole(ADMIN_ROLE) {
        uint256 oldFee = reviewFee;
        reviewFee = _newFee;
        emit ReviewFeeUpdated(oldFee, _newFee);
    }
    
    /**
     * @notice Fügt Updater Rolle hinzu
     * @param _updater Adresse die Updater werden soll
     */
    function addUpdater(address _updater) 
        external 
        onlyRole(ADMIN_ROLE) 
        validAddress(_updater) 
    {
        _grantRole(UPDATER_ROLE, _updater);
        emit RoleGranted(UPDATER_ROLE, _updater, msg.sender);
    }
    
    /**
     * @notice Entfernt Updater Rolle
     * @param _updater Adresse die entfernt werden soll
     */
    function removeUpdater(address _updater) 
        external 
        onlyRole(ADMIN_ROLE) 
        validAddress(_updater) 
    {
        _revokeRole(UPDATER_ROLE, _updater);
        emit RoleRevoked(UPDATER_ROLE, _updater, msg.sender);
    }
    
    /**
     * @notice Emergency Withdrawal von ETH
     * @param _recipient Empfänger der Funds
     * @param _amount Betrag in wei
     */
    function emergencyWithdrawETH(address _recipient, uint256 _amount) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
        validAddress(_recipient) 
        nonReentrant 
    {
        require(_amount > 0, "Amount must be greater than 0");
        require(address(this).balance >= _amount, "Insufficient balance");
        
        (bool success, ) = payable(_recipient).call{value: _amount}("");
        require(success, "Transfer failed");
        
        emit EmergencyWithdrawal(address(0), _amount, _recipient);
    }
    
    // ============ Core Functions ============
    
    /**
     * @notice Aktualisiert Reputation nach einem Deal
     * @param _agent Der Agent dessen Reputation aktualisiert wird
     * @param _successful Ob der Deal erfolgreich war
     * @param _score Der Score für diesen Deal (0-50)
     * @dev Nur UPDATER_ROLE kann Reputation updaten
     * @dev Protected against reentrancy
     */
    function updateReputation(
        address _agent,
        bool _successful,
        uint256 _score
    ) 
        external 
        onlyRole(UPDATER_ROLE) 
        validAddress(_agent)
        validScore(_score)
        whenNotPaused
        nonReentrant 
    {
        // Checks
        require(_agent != msg.sender, "Cannot update own reputation");
        
        // Effects
        Reputation storage rep = reputations[_agent];
        
        // Initialisieren wenn neu
        if (!rep.exists) {
            rep.totalScore = INITIAL_SCORE;
            rep.exists = true;
        }
        
        // Score aktualisieren (gewichteter Durchschnitt)
        uint256 newScore = _calculateNewScore(rep.totalScore, _score, _successful);
        
        // Update state
        rep.totalScore = newScore;
        if (_successful) {
            rep.successfulDeals++;
        } else {
            rep.failedDeals++;
        }
        rep.reviewCount++;
        rep.lastUpdate = block.timestamp;
        
        // Interactions (Events only, no external calls)
        emit ReputationUpdated(_agent, newScore, rep.reviewCount, _successful, msg.sender);
    }
    
    /**
     * @notice Fügt ein detailliertes Review hinzu
     * @param _agent Der Agent der reviewt wird
     * @param _score Der Score (0-50)
     * @param _comment Kommentar
     * @param _dealId Deal Referenz
     */
    function addReview(
        address _agent,
        uint256 _score,
        string calldata _comment,
        bytes32 _dealId
    ) 
        external 
        payable
        validAddress(_agent)
        validScore(_score)
        validComment(_comment)
        whenNotPaused
        nonReentrant 
    {
        // Checks
        require(_agent != msg.sender, "Cannot review yourself");
        require(_dealId != bytes32(0), "Invalid deal ID");
        require(msg.value >= reviewFee, "Insufficient fee");
        
        // Pay fee if set
        if (reviewFee > 0) {
            (bool success, ) = payable(treasury).call{value: reviewFee}("");
            require(success, "Fee transfer failed");
        }
        
        // Refund excess
        if (msg.value > reviewFee) {
            (bool success, ) = payable(msg.sender).call{value: msg.value - reviewFee}("");
            require(success, "Refund failed");
        }
        
        // Effects
        uint256 reviewId = reviewCounts[_agent];
        
        reviews[_agent][reviewId] = Review({
            reviewer: msg.sender,
            score: _score,
            comment: _comment,
            timestamp: block.timestamp,
            dealId: _dealId,
            exists: true
        });
        
        reviewCounts[_agent]++;
        
        // Update reputation as well
        _internalUpdateReputation(_agent, true, _score);
        
        emit ReviewAdded(_agent, msg.sender, _score, _dealId, reviewId);
    }
    
    /**
     * @notice Batch Reputation Update
     * @param _agents Array von Agent Adressen
     * @param _successful Array von Erfolgsstatus
     * @param _scores Array von Scores
     * @dev Max 100 Agents pro Batch (Gas Limit)
     */
    function batchUpdateReputation(
        address[] calldata _agents,
        bool[] calldata _successful,
        uint256[] calldata _scores
    ) 
        external 
        onlyRole(UPDATER_ROLE)
        whenNotPaused
        nonReentrant 
    {
        // Validation
        uint256 length = _agents.length;
        require(length > 0, "Empty batch");
        require(length <= MAX_BATCH_SIZE, "Batch too large");
        require(length == _successful.length && length == _scores.length, "Array length mismatch");
        
        for (uint256 i = 0; i < length; i++) {
            address agent = _agents[i];
            
            // Skip invalid entries but don't revert whole batch
            if (agent == address(0) || agent == msg.sender) continue;
            if (_scores[i] > MAX_SCORE) continue;
            
            _internalUpdateReputation(agent, _successful[i], _scores[i]);
        }
    }
    
    // ============ Internal Functions ============
    
    /**
     * @notice Interne Reputation Update (keine Checks)
     */
    function _internalUpdateReputation(
        address _agent,
        bool _successful,
        uint256 _score
    ) internal {
        Reputation storage rep = reputations[_agent];
        
        if (!rep.exists) {
            rep.totalScore = INITIAL_SCORE;
            rep.exists = true;
        }
        
        uint256 newScore = _calculateNewScore(rep.totalScore, _score, _successful);
        
        rep.totalScore = newScore;
        if (_successful) {
            rep.successfulDeals++;
        } else {
            rep.failedDeals++;
        }
        rep.reviewCount++;
        rep.lastUpdate = block.timestamp;
        
        emit ReputationUpdated(_agent, newScore, rep.reviewCount, _successful, msg.sender);
    }
    
    /**
     * @notice Berechnet neuen Score
     */
    function _calculateNewScore(
        uint256 _currentScore,
        uint256 _newScore,
        bool _successful
    ) internal pure returns (uint256) {
        uint256 result;
        
        if (_successful) {
            // Neue Reviews haben 20% Gewicht
            result = _currentScore * 80 / 100 + _newScore * 20 / 100;
        } else {
            // Bei Fehlern stärker abwerten
            result = _currentScore * 70 / 100;
        }
        
        // Begrenzen
        if (result > MAX_SCORE) result = MAX_SCORE;
        if (result < MIN_SCORE) result = MIN_SCORE;
        
        return result;
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Holt Reputation für einen Agenten
     */
    function getReputation(address _agent) 
        external 
        view 
        validAddress(_agent)
        returns (
            uint256 score,
            uint256 reviewCount,
            uint256 successfulDeals,
            uint256 failedDeals,
            uint256 avgScore,
            bool exists
        ) 
    {
        Reputation storage rep = reputations[_agent];
        
        if (!rep.exists) {
            return (INITIAL_SCORE, 0, 0, 0, INITIAL_SCORE, false);
        }
        
        return (
            rep.totalScore,
            rep.reviewCount,
            rep.successfulDeals,
            rep.failedDeals,
            rep.totalScore,
            true
        );
    }
    
    /**
     * @notice Prüft ob Agent existiert
     */
    function agentExists(address _agent) external view returns (bool) {
        return reputations[_agent].exists;
    }
    
    /**
     * @notice Holt Reviews für einen Agenten (paginiert)
     */
    function getReviews(
        address _agent,
        uint256 _start,
        uint256 _limit
    ) 
        external 
        view 
        validAddress(_agent)
        returns (Review[] memory) 
    {
        uint256 total = reviewCounts[_agent];
        if (_start >= total) return new Review[](0);
        if (_limit > MAX_BATCH_SIZE) _limit = MAX_BATCH_SIZE;
        
        uint256 end = _start + _limit;
        if (end > total) end = total;
        
        Review[] memory result = new Review[](end - _start);
        for (uint256 i = _start; i < end; i++) {
            result[i - _start] = reviews[_agent][i];
        }
        
        return result;
    }
    
    /**
     * @notice Vergleicht zwei Agenten
     */
    function compareAgents(
        address _agent1,
        address _agent2
    ) 
        external 
        view 
        validAddress(_agent1)
        validAddress(_agent2)
        returns (
            uint256 score1,
            uint256 score2,
            address betterAgent
        ) 
    {
        Reputation storage rep1 = reputations[_agent1];
        Reputation storage rep2 = reputations[_agent2];
        
        score1 = rep1.exists ? rep1.totalScore : INITIAL_SCORE;
        score2 = rep2.exists ? rep2.totalScore : INITIAL_SCORE;
        
        betterAgent = score1 >= score2 ? _agent1 : _agent2;
    }
    
    /**
     * @notice Holt Top-Agenten nach Reputation
     */
    function getTopAgents(
        address[] calldata _agents
    ) 
        external 
        view 
        returns (
            address[] memory sortedAgents,
            uint256[] memory scores
        ) 
    {
        uint256 n = _agents.length;
        require(n <= MAX_BATCH_SIZE, "Array too large");
        
        sortedAgents = new address[](n);
        scores = new uint256[](n);
        
        // Kopieren
        for (uint256 i = 0; i < n; i++) {
            sortedAgents[i] = _agents[i];
            Reputation storage rep = reputations[_agents[i]];
            scores[i] = rep.exists ? rep.totalScore : INITIAL_SCORE;
        }
        
        // Bubble Sort (absteigend)
        for (uint256 i = 0; i < n - 1; i++) {
            for (uint256 j = 0; j < n - i - 1; j++) {
                if (scores[j] < scores[j + 1]) {
                    // Swap
                    (scores[j], scores[j + 1]) = (scores[j + 1], scores[j]);
                    (sortedAgents[j], sortedAgents[j + 1]) = (sortedAgents[j + 1], sortedAgents[j]);
                }
            }
        }
        
        return (sortedAgents, scores);
    }
    
    /**
     * @notice Holt Contract Balance
     */
    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }
    
    // ============ Receive Function ============
    
    receive() external payable {
        // Accept ETH but emit event
        emit EmergencyWithdrawal(address(0), msg.value, address(this));
    }
}
