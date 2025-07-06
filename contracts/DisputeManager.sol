// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./StakeManager.sol";
import "./ReviewPool.sol";

contract DisputeManager is Ownable {
    struct Dispute {
        uint256 disputeId;
        uint256 paperId;
        address reviewerBeingDisputed;
        address disputer;
        string reason;
        uint256 disputeStake;
        uint256 createdTime;
        uint256 votingDeadline;
        DisputeStatus status;
        uint256 votesFor; // votes supporting the dispute
        uint256 votesAgainst; // votes against the dispute
        address[] jurors;
        mapping(address => bool) hasVoted;
        mapping(address => bool) voteChoice; // true = support dispute, false = reject dispute
    }
    
    enum DisputeStatus {
        Pending,
        Voting,
        Resolved,
        Rejected
    }
    
    uint256 public constant DISPUTE_STAKE = 100 ether; // 100 GO tokens to file dispute
    uint256 public constant VOTING_PERIOD = 3 days;
    uint256 public constant JUROR_COUNT = 1;
    uint256 public constant JUROR_REWARD = 20 ether; // 20 GO tokens per juror
    
    StakeManager public immutable stakeManager;
    ReviewPool public immutable reviewPool;
    
    uint256 public nextDisputeId;
    mapping(uint256 => Dispute) public disputes;
    mapping(uint256 => mapping(address => uint256)) public paperReviewerDisputes; // paperId => reviewer => disputeId
    
    event DisputeCreated(uint256 indexed disputeId, uint256 indexed paperId, address indexed reviewer, address disputer, string reason);
    event JurorAssigned(uint256 indexed disputeId, address indexed juror);
    event DisputeVoted(uint256 indexed disputeId, address indexed juror, bool voteChoice);
    event DisputeResolved(uint256 indexed disputeId, bool disputeWon, address disputer);
    
    constructor(
        address payable _stakeManager,
        address _reviewPool
    ) Ownable(msg.sender) {
        stakeManager = StakeManager(_stakeManager);
        reviewPool = ReviewPool(_reviewPool);
        nextDisputeId = 1;
    }
    
    function createDispute(
        uint256 paperId,
        address reviewer,
        string calldata reason
    ) external {
        require(bytes(reason).length > 10, "Dispute reason too short");
        require(paperReviewerDisputes[paperId][reviewer] == 0, "Review already disputed");
        require(stakeManager.balanceOf(msg.sender) >= DISPUTE_STAKE, "Insufficient balance for dispute stake");
        
        // Check that the review exists and is revealed
        ReviewPool.Review memory review = reviewPool.getReview(paperId, reviewer);
        require(review.reviewer == reviewer, "Review not found");
        require(review.isRevealed, "Review not revealed yet");
        
        // Transfer dispute stake
        stakeManager.transferFrom(msg.sender, address(this), DISPUTE_STAKE);
        
        uint256 disputeId = nextDisputeId++;
        Dispute storage dispute = disputes[disputeId];
        dispute.disputeId = disputeId;
        dispute.paperId = paperId;
        dispute.reviewerBeingDisputed = reviewer;
        dispute.disputer = msg.sender;
        dispute.reason = reason;
        dispute.disputeStake = DISPUTE_STAKE;
        dispute.createdTime = block.timestamp;
        dispute.votingDeadline = block.timestamp + VOTING_PERIOD;
        dispute.status = DisputeStatus.Pending;
        
        paperReviewerDisputes[paperId][reviewer] = disputeId;
        
        emit DisputeCreated(disputeId, paperId, reviewer, msg.sender, reason);
        
        // Automatically start voting if we have enough eligible jurors
        _startVoting(disputeId);
    }
    
    function _startVoting(uint256 disputeId) internal {
        Dispute storage dispute = disputes[disputeId];
        require(dispute.status == DisputeStatus.Pending, "Dispute not pending");
        
        address[] memory eligibleReviewers = stakeManager.getEligibleReviewers();
        require(eligibleReviewers.length >= JUROR_COUNT, "Not enough eligible reviewers for jury");
        
        // Simple selection: take first JUROR_COUNT reviewers who are not the disputer or disputed reviewer
        uint256 selectedCount = 0;
        for (uint256 i = 0; i < eligibleReviewers.length && selectedCount < JUROR_COUNT; i++) {
            address potential = eligibleReviewers[i];
            if (potential != dispute.disputer && potential != dispute.reviewerBeingDisputed) {
                dispute.jurors.push(potential);
                emit JurorAssigned(disputeId, potential);
                selectedCount++;
            }
        }
        
        if (selectedCount >= JUROR_COUNT) {
            dispute.status = DisputeStatus.Voting;
        }
    }
    
    function voteOnDispute(uint256 disputeId, bool supportDispute) external {
        Dispute storage dispute = disputes[disputeId];
        require(dispute.status == DisputeStatus.Voting, "Dispute not in voting phase");
        require(block.timestamp <= dispute.votingDeadline, "Voting period expired");
        require(!dispute.hasVoted[msg.sender], "Already voted");
        
        // Check if sender is a juror
        bool isJuror = false;
        for (uint256 i = 0; i < dispute.jurors.length; i++) {
            if (dispute.jurors[i] == msg.sender) {
                isJuror = true;
                break;
            }
        }
        require(isJuror, "Not selected as juror");
        
        dispute.hasVoted[msg.sender] = true;
        dispute.voteChoice[msg.sender] = supportDispute;
        
        if (supportDispute) {
            dispute.votesFor++;
        } else {
            dispute.votesAgainst++;
        }
        
        emit DisputeVoted(disputeId, msg.sender, supportDispute);
        
        // Check if we can resolve immediately (majority reached)
        uint256 totalVotes = dispute.votesFor + dispute.votesAgainst;
        if (totalVotes == dispute.jurors.length || block.timestamp > dispute.votingDeadline) {
            _resolveDispute(disputeId);
        }
    }
    
    function resolveDispute(uint256 disputeId) external {
        Dispute storage dispute = disputes[disputeId];
        require(dispute.status == DisputeStatus.Voting, "Dispute not in voting phase");
        require(block.timestamp > dispute.votingDeadline, "Voting period not expired");
        
        _resolveDispute(disputeId);
    }
    
    function _resolveDispute(uint256 disputeId) internal {
        Dispute storage dispute = disputes[disputeId];
        
        bool disputeWon = dispute.votesFor > dispute.votesAgainst;
        
        if (disputeWon) {
            // Dispute was valid
            dispute.status = DisputeStatus.Resolved;
            
            // Return stake to disputer + reward
            uint256 totalReward = dispute.disputeStake + (JUROR_REWARD * dispute.jurors.length);
            stakeManager.transfer(dispute.disputer, totalReward);
            
            // Slash the disputed reviewer (30% of their stake)
            stakeManager.slashReviewer(dispute.reviewerBeingDisputed, 30);
            
            // Reward jurors who voted correctly (for the dispute)
            for (uint256 i = 0; i < dispute.jurors.length; i++) {
                address juror = dispute.jurors[i];
                if (dispute.hasVoted[juror] && dispute.voteChoice[juror]) {
                    stakeManager.transfer(juror, JUROR_REWARD);
                }
            }
        } else {
            // Dispute was invalid
            dispute.status = DisputeStatus.Rejected;
            
            // Stake goes to the disputed reviewer as compensation
            stakeManager.transfer(dispute.reviewerBeingDisputed, dispute.disputeStake);
            
            // Reward jurors who voted correctly (against the dispute)
            for (uint256 i = 0; i < dispute.jurors.length; i++) {
                address juror = dispute.jurors[i];
                if (dispute.hasVoted[juror] && !dispute.voteChoice[juror]) {
                    stakeManager.transfer(juror, JUROR_REWARD);
                }
            }
        }
        
        emit DisputeResolved(disputeId, disputeWon, dispute.disputer);
    }
    
    function getDispute(uint256 disputeId) external view returns (
        uint256 paperId,
        address reviewerBeingDisputed,
        address disputer,
        string memory reason,
        uint256 disputeStake,
        uint256 createdTime,
        uint256 votingDeadline,
        DisputeStatus status,
        uint256 votesFor,
        uint256 votesAgainst,
        address[] memory jurors
    ) {
        Dispute storage dispute = disputes[disputeId];
        return (
            dispute.paperId,
            dispute.reviewerBeingDisputed,
            dispute.disputer,
            dispute.reason,
            dispute.disputeStake,
            dispute.createdTime,
            dispute.votingDeadline,
            dispute.status,
            dispute.votesFor,
            dispute.votesAgainst,
            dispute.jurors
        );
    }
    
    function getActiveDisputes() external view returns (uint256[] memory) {
        uint256[] memory activeDisputes = new uint256[](nextDisputeId - 1);
        uint256 count = 0;
        
        for (uint256 i = 1; i < nextDisputeId; i++) {
            if (disputes[i].status == DisputeStatus.Pending || disputes[i].status == DisputeStatus.Voting) {
                activeDisputes[count] = i;
                count++;
            }
        }
        
        // Resize array to actual count
        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = activeDisputes[i];
        }
        
        return result;
    }
    
    function getDisputeForReview(uint256 paperId, address reviewer) external view returns (uint256) {
        return paperReviewerDisputes[paperId][reviewer];
    }
    
    function isJurorForDispute(uint256 disputeId, address juror) external view returns (bool) {
        Dispute storage dispute = disputes[disputeId];
        for (uint256 i = 0; i < dispute.jurors.length; i++) {
            if (dispute.jurors[i] == juror) {
                return true;
            }
        }
        return false;
    }
    
    function hasVotedOnDispute(uint256 disputeId, address juror) external view returns (bool) {
        return disputes[disputeId].hasVoted[juror];
    }
}