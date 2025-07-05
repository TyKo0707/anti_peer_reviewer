// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract StakeManager is ERC20, Ownable, ReentrancyGuard {
    struct Reviewer {
        uint256 stake;
        uint256 reputation;
        bool isActive;
        uint256 lastActivityTime;
        uint256 reviewCount;
        uint256 successfulReviews;
    }
    
    uint256 public constant MIN_STAKE = 1000 ether;
    uint256 public constant INITIAL_REPUTATION = 50;
    uint256 public constant MAX_REPUTATION = 100;
    uint256 public constant REPUTATION_DECAY_PERIOD = 30 days;
    
    mapping(address => Reviewer) public reviewers;
    address[] public reviewerList;
    
    event ReviewerStaked(address indexed reviewer, uint256 amount);
    event ReviewerUnstaked(address indexed reviewer, uint256 amount);
    event ReviewerSlashed(address indexed reviewer, uint256 amount, uint256 percentage);
    event ReputationUpdated(address indexed reviewer, uint256 oldReputation, uint256 newReputation);
    
    constructor() ERC20("Peer-Review Token", "PROOF") Ownable() {
        // Mint initial supply for testing
        _mint(msg.sender, 1000000 ether);
    }
    
    function stakeToBeReviewer() external nonReentrant {
        require(balanceOf(msg.sender) >= MIN_STAKE, "Insufficient balance");
        require(reviewers[msg.sender].stake == 0, "Already staked");
        
        _transfer(msg.sender, address(this), MIN_STAKE);
        
        reviewers[msg.sender] = Reviewer({
            stake: MIN_STAKE,
            reputation: INITIAL_REPUTATION,
            isActive: true,
            lastActivityTime: block.timestamp,
            reviewCount: 0,
            successfulReviews: 0
        });
        
        reviewerList.push(msg.sender);
        
        emit ReviewerStaked(msg.sender, MIN_STAKE);
    }
    
    function unstakeReviewer() external nonReentrant {
        Reviewer storage reviewer = reviewers[msg.sender];
        require(reviewer.stake > 0, "Not staked");
        require(reviewer.isActive, "Not active");
        
        uint256 stakeAmount = reviewer.stake;
        reviewer.stake = 0;
        reviewer.isActive = false;
        
        // Remove from reviewer list
        for (uint256 i = 0; i < reviewerList.length; i++) {
            if (reviewerList[i] == msg.sender) {
                reviewerList[i] = reviewerList[reviewerList.length - 1];
                reviewerList.pop();
                break;
            }
        }
        
        _transfer(address(this), msg.sender, stakeAmount);
        
        emit ReviewerUnstaked(msg.sender, stakeAmount);
    }
    
    function slashReviewer(address reviewer, uint256 percentage) external onlyOwner {
        require(percentage <= 100, "Invalid percentage");
        
        Reviewer storage reviewerData = reviewers[reviewer];
        require(reviewerData.stake > 0, "Reviewer not staked");
        
        uint256 slashAmount = (reviewerData.stake * percentage) / 100;
        reviewerData.stake -= slashAmount;
        
        // Burn slashed tokens
        _burn(address(this), slashAmount);
        
        // Reduce reputation
        if (reviewerData.reputation > 10) {
            reviewerData.reputation -= 10;
        } else {
            reviewerData.reputation = 0;
        }
        
        emit ReviewerSlashed(reviewer, slashAmount, percentage);
    }
    
    function updateReputation(address reviewer, bool positive) external onlyOwner {
        Reviewer storage reviewerData = reviewers[reviewer];
        require(reviewerData.isActive, "Reviewer not active");
        
        uint256 oldReputation = reviewerData.reputation;
        
        if (positive) {
            if (reviewerData.reputation < MAX_REPUTATION) {
                reviewerData.reputation += 1;
            }
            reviewerData.successfulReviews++;
        } else {
            if (reviewerData.reputation > 0) {
                reviewerData.reputation -= 1;
            }
        }
        
        reviewerData.reviewCount++;
        reviewerData.lastActivityTime = block.timestamp;
        
        emit ReputationUpdated(reviewer, oldReputation, reviewerData.reputation);
    }
    
    function applyReputationDecay() external {
        for (uint256 i = 0; i < reviewerList.length; i++) {
            address reviewer = reviewerList[i];
            Reviewer storage reviewerData = reviewers[reviewer];
            
            if (block.timestamp - reviewerData.lastActivityTime > REPUTATION_DECAY_PERIOD) {
                uint256 oldReputation = reviewerData.reputation;
                if (reviewerData.reputation > 0) {
                    reviewerData.reputation = (reviewerData.reputation * 95) / 100; // 5% decay
                }
                
                if (oldReputation != reviewerData.reputation) {
                    emit ReputationUpdated(reviewer, oldReputation, reviewerData.reputation);
                }
            }
        }
    }
    
    function getEligibleReviewers() external view returns (address[] memory) {
        uint256 eligibleCount = 0;
        
        // Count eligible reviewers
        for (uint256 i = 0; i < reviewerList.length; i++) {
            if (reviewers[reviewerList[i]].isActive && reviewers[reviewerList[i]].stake >= MIN_STAKE) {
                eligibleCount++;
            }
        }
        
        // Create array of eligible reviewers
        address[] memory eligible = new address[](eligibleCount);
        uint256 index = 0;
        
        for (uint256 i = 0; i < reviewerList.length; i++) {
            if (reviewers[reviewerList[i]].isActive && reviewers[reviewerList[i]].stake >= MIN_STAKE) {
                eligible[index] = reviewerList[i];
                index++;
            }
        }
        
        return eligible;
    }
    
    function getReviewerWeight(address reviewer) external view returns (uint256) {
        Reviewer memory reviewerData = reviewers[reviewer];
        if (!reviewerData.isActive) return 0;
        
        // Weight = stake * reputation
        return reviewerData.stake * reviewerData.reputation;
    }
    
    function getReviewer(address reviewer) external view returns (Reviewer memory) {
        return reviewers[reviewer];
    }
    
    function getReviewerCount() external view returns (uint256) {
        return reviewerList.length;
    }
    
    function distributeTokens(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}