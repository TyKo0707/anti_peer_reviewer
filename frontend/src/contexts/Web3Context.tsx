import React, { createContext, useContext } from 'react';
import { ethers } from 'ethers';

interface Web3ContextType {
  account: string | null;
  provider: ethers.BrowserProvider | null;
  signer: ethers.JsonRpcSigner | null;
  connectWallet: () => Promise<void>;
  forceRefresh: () => void;
}

const Web3Context = createContext<Web3ContextType | undefined>(undefined);

export const Web3Provider: React.FC<{ children: React.ReactNode; value: Web3ContextType }> = ({ children, value }) => {
  return <Web3Context.Provider value={value}>{children}</Web3Context.Provider>;
};

export const useWeb3 = (): Web3ContextType => {
  const context = useContext(Web3Context);
  if (!context) {
    throw new Error('useWeb3 must be used within a Web3Provider');
  }
  return context;
};

// Contract addresses - these should be updated after deployment
export const CONTRACT_ADDRESSES = {
  PAPER_REGISTRY: '0x9A676e781A523b5d0C0e43731313A708CB607508',
  REVIEW_POOL: '0x0B306BF915C4d645ff596e518fAf3F9669b97016',
  STAKE_MANAGER: '0x0DCd1Bf9A1b36cE34237eEaFef220932846BCD82',
  DISPUTE_MANAGER: '0x959922bE3CAee4b8Cd9a407cc3ac1C251C2007B1',
};

// Contract ABIs (simplified for PoC)
export const PAPER_REGISTRY_ABI = [
  'function submitPaper(string calldata cid, string[] calldata keywords, string calldata fieldClassification, bool isEmbargoed, uint256 embargoEndTime) external payable returns (uint256)',
  'function getPaper(uint256 paperId) external view returns (tuple(string cid, address author, uint256 submissionTime, uint256 publicationFee, bool isPublished, uint256 totalScore, uint256 reviewCount, bool isEmbargoed, uint256 embargoEndTime, string[] keywords, string fieldClassification))',
  'function getAuthorPapers(address author) external view returns (uint256[])',
  'function publicationFee() external view returns (uint256)',
  'function nextPaperId() external view returns (uint256)',
  'event PaperSubmitted(uint256 indexed paperId, address indexed author, string cid)'
];

export const REVIEW_POOL_ABI = [
  'function assignReviewers(uint256 paperId) external',
  'function submitReview(uint256 paperId, int8 score, string calldata comment) external',
  'function revealReview(uint256 paperId, int8 score, string calldata plainTextComment) external',
  'function getAssignedReviewers(uint256 paperId) external view returns (address[])',
  'function getReview(uint256 paperId, address reviewer) external view returns (tuple(uint256 paperId, address reviewer, int8 score, bytes32 commentHash, string encryptedComment, bool isRevealed, uint256 submitTime))',
  'function isAssignedReviewer(uint256 paperId, address reviewer) external view returns (bool)',
  'function assignments(uint256 paperId) external view returns (tuple(uint256, address[], uint256, uint256, bool))',
  'function getAllReviews(uint256 paperId) external view returns (tuple(uint256 paperId, address reviewer, int8 score, bytes32 commentHash, string encryptedComment, bool isRevealed, uint256 submitTime)[])',
  'function getReviewsForPaper(uint256 paperId) external view returns (address[] reviewers, int8[] scores, string[] comments, uint256[] submitTimes, bool isFinalized)',
  'event ReviewersAssigned(uint256 indexed paperId, address[] reviewers)',
  'event ReviewSubmitted(uint256 indexed paperId, address indexed reviewer, bytes32 commentHash)'
];

export const STAKE_MANAGER_ABI = [
  'function stakeToBeReviewer() external',
  'function unstakeReviewer() external',
  'function getReviewer(address reviewer) external view returns (tuple(uint256 stake, uint256 reputation, bool isActive, uint256 lastActivityTime, uint256 reviewCount, uint256 successfulReviews))',
  'function balanceOf(address account) external view returns (uint256)',
  'function transfer(address to, uint256 amount) external returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) external returns (bool)',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function MIN_STAKE() external view returns (uint256)',
  'function claimFaucetTokens() external',
  'function hasClaimedFaucet(address account) external view returns (bool)',
  'event ReviewerStaked(address indexed reviewer, uint256 amount)'
];

export const DISPUTE_MANAGER_ABI = [
  'function createDispute(uint256 paperId, address reviewer, string calldata reason) external',
  'function voteOnDispute(uint256 disputeId, bool supportDispute) external',
  'function resolveDispute(uint256 disputeId) external',
  'function getDispute(uint256 disputeId) external view returns (uint256 paperId, address reviewerBeingDisputed, address disputer, string reason, uint256 disputeStake, uint256 createdTime, uint256 votingDeadline, uint8 status, uint256 votesFor, uint256 votesAgainst, address[] jurors)',
  'function getActiveDisputes() external view returns (uint256[])',
  'function getDisputeForReview(uint256 paperId, address reviewer) external view returns (uint256)',
  'function isJurorForDispute(uint256 disputeId, address juror) external view returns (bool)',
  'function hasVotedOnDispute(uint256 disputeId, address juror) external view returns (bool)',
  'function DISPUTE_STAKE() external view returns (uint256)',
  'event DisputeCreated(uint256 indexed disputeId, uint256 indexed paperId, address indexed reviewer, address disputer, string reason)',
  'event DisputeVoted(uint256 indexed disputeId, address indexed juror, bool voteChoice)',
  'event DisputeResolved(uint256 indexed disputeId, bool disputeWon, address disputer)'
];
