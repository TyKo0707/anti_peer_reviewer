// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./StakeManager.sol";
import "./PaperRegistry.sol";

interface IVRFCoordinatorV2 {
    function requestRandomWords(
        bytes32 keyHash,
        uint64 subId,
        uint16 minimumRequestConfirmations,
        uint32 callbackGasLimit,
        uint32 numWords
    ) external returns (uint256 requestId);
}

contract ReviewPool is VRFConsumerBaseV2, Ownable {
    struct Review {
        uint256 paperId;
        address reviewer;
        int8 score; // -2 to +2
        bytes32 commentHash;
        string encryptedComment;
        bool isRevealed;
        uint256 submitTime;
    }
    
    struct ReviewAssignment {
        uint256 paperId;
        address[] assignedReviewers;
        uint256 deadline;
        uint256 reviewCount;
        bool isCompleted;
    }
    
    uint256 public constant REVIEW_PERIOD = 7 days;
    uint256 public constant REVEAL_PERIOD = 2 days;
    uint256 public constant REVIEWERS_PER_PAPER = 3;
    
    StakeManager public immutable stakeManager;
    PaperRegistry public immutable paperRegistry;
    IVRFCoordinatorV2 public immutable vrfCoordinator;
    
    bytes32 public immutable keyHash;
    uint64 public immutable subscriptionId;
    
    mapping(uint256 => ReviewAssignment) public assignments;
    mapping(uint256 => mapping(address => Review)) public reviews;
    mapping(uint256 => uint256) public vrfRequestToPaperId;
    
    event ReviewersAssigned(uint256 indexed paperId, address[] reviewers);
    event ReviewSubmitted(uint256 indexed paperId, address indexed reviewer, bytes32 commentHash);
    event ReviewRevealed(uint256 indexed paperId, address indexed reviewer, int8 score);
    event ReviewCompleted(uint256 indexed paperId, bool accepted);
    
    constructor(
        address _vrfCoordinator,
        bytes32 _keyHash,
        uint64 _subscriptionId,
        address _stakeManager,
        address _paperRegistry
    ) VRFConsumerBaseV2(_vrfCoordinator) Ownable() {
        vrfCoordinator = IVRFCoordinatorV2(_vrfCoordinator);
        keyHash = _keyHash;
        subscriptionId = _subscriptionId;
        stakeManager = StakeManager(_stakeManager);
        paperRegistry = PaperRegistry(_paperRegistry);
    }
    
    function assignReviewers(uint256 paperId) external onlyOwner {
        require(assignments[paperId].paperId == 0, "Already assigned");
        
        // Request random words from Chainlink VRF
        uint256 requestId = vrfCoordinator.requestRandomWords(
            keyHash,
            subscriptionId,
            3, // minimum confirmations
            300000, // callback gas limit
            1 // number of random words
        );
        
        vrfRequestToPaperId[requestId] = paperId;
        
        assignments[paperId].paperId = paperId;
        assignments[paperId].deadline = block.timestamp + REVIEW_PERIOD;
    }
    
    function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) internal override {
        uint256 paperId = vrfRequestToPaperId[requestId];
        require(paperId != 0, "Invalid request");
        
        address[] memory eligibleReviewers = stakeManager.getEligibleReviewers();
        require(eligibleReviewers.length >= REVIEWERS_PER_PAPER, "Not enough eligible reviewers");
        
        address[] memory selectedReviewers = new address[](REVIEWERS_PER_PAPER);
        uint256 randomSeed = randomWords[0];
        
        for (uint256 i = 0; i < REVIEWERS_PER_PAPER; i++) {
            uint256 index = uint256(keccak256(abi.encode(randomSeed, i))) % eligibleReviewers.length;
            selectedReviewers[i] = eligibleReviewers[index];
            
            // Remove selected reviewer from pool to avoid duplicates
            eligibleReviewers[index] = eligibleReviewers[eligibleReviewers.length - 1];
            assembly {
                mstore(eligibleReviewers, sub(mload(eligibleReviewers), 1))
            }
        }
        
        assignments[paperId].assignedReviewers = selectedReviewers;
        
        emit ReviewersAssigned(paperId, selectedReviewers);
    }
    
    function submitReview(
        uint256 paperId,
        int8 score,
        bytes32 commentHash,
        string calldata encryptedComment
    ) external {
        require(isAssignedReviewer(paperId, msg.sender), "Not assigned reviewer");
        require(block.timestamp <= assignments[paperId].deadline, "Review period expired");
        require(score >= -2 && score <= 2, "Invalid score range");
        require(reviews[paperId][msg.sender].reviewer == address(0), "Already submitted");
        
        reviews[paperId][msg.sender] = Review({
            paperId: paperId,
            reviewer: msg.sender,
            score: score,
            commentHash: commentHash,
            encryptedComment: encryptedComment,
            isRevealed: false,
            submitTime: block.timestamp
        });
        
        assignments[paperId].reviewCount++;
        
        emit ReviewSubmitted(paperId, msg.sender, commentHash);
    }
    
    function revealReview(
        uint256 paperId,
        int8 score,
        string calldata plainTextComment
    ) external {
        Review storage review = reviews[paperId][msg.sender];
        require(review.reviewer == msg.sender, "Review not found");
        require(!review.isRevealed, "Already revealed");
        require(
            block.timestamp > assignments[paperId].deadline &&
            block.timestamp <= assignments[paperId].deadline + REVEAL_PERIOD,
            "Not in reveal period"
        );
        
        bytes32 expectedHash = keccak256(abi.encodePacked(score, plainTextComment));
        require(expectedHash == review.commentHash, "Hash mismatch");
        
        review.isRevealed = true;
        
        // Update paper score
        paperRegistry.updatePaperScore(paperId, score);
        
        // Update reviewer reputation
        stakeManager.updateReputation(msg.sender, true); // Positive for revealing on time
        
        emit ReviewRevealed(paperId, msg.sender, score);
        
        // Check if all reviews are revealed
        if (areAllReviewsRevealed(paperId)) {
            finalizeReview(paperId);
        }
    }
    
    function finalizeReview(uint256 paperId) internal {
        require(!assignments[paperId].isCompleted, "Already completed");
        
        PaperRegistry.Paper memory paper = paperRegistry.getPaper(paperId);
        bool accepted = paper.totalScore >= 3 && paper.reviewCount >= 2;
        
        assignments[paperId].isCompleted = true;
        
        if (accepted) {
            paperRegistry.publishPaper(paperId);
        } else {
            paperRegistry.rejectPaper(paperId);
        }
        
        emit ReviewCompleted(paperId, accepted);
    }
    
    function slashUnresponsiveReviewers(uint256 paperId) external onlyOwner {
        require(
            block.timestamp > assignments[paperId].deadline + REVEAL_PERIOD,
            "Reveal period not expired"
        );
        
        address[] memory assignedReviewers = assignments[paperId].assignedReviewers;
        
        for (uint256 i = 0; i < assignedReviewers.length; i++) {
            address reviewer = assignedReviewers[i];
            Review memory review = reviews[paperId][reviewer];
            
            if (review.reviewer == address(0) || !review.isRevealed) {
                // Slash unresponsive reviewer
                stakeManager.slashReviewer(reviewer, 30); // 30% slash
            }
        }
    }
    
    function isAssignedReviewer(uint256 paperId, address reviewer) public view returns (bool) {
        address[] memory assignedReviewers = assignments[paperId].assignedReviewers;
        for (uint256 i = 0; i < assignedReviewers.length; i++) {
            if (assignedReviewers[i] == reviewer) {
                return true;
            }
        }
        return false;
    }
    
    function areAllReviewsRevealed(uint256 paperId) public view returns (bool) {
        address[] memory assignedReviewers = assignments[paperId].assignedReviewers;
        for (uint256 i = 0; i < assignedReviewers.length; i++) {
            Review memory review = reviews[paperId][assignedReviewers[i]];
            if (review.reviewer == address(0) || !review.isRevealed) {
                return false;
            }
        }
        return true;
    }
    
    function getAssignedReviewers(uint256 paperId) external view returns (address[] memory) {
        return assignments[paperId].assignedReviewers;
    }
    
    function getReview(uint256 paperId, address reviewer) external view returns (Review memory) {
        return reviews[paperId][reviewer];
    }
}