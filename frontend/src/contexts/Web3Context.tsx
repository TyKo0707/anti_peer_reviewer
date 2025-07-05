import React, { createContext, useContext } from 'react';
import { ethers } from 'ethers';

interface Web3ContextType {
  account: string | null;
  provider: ethers.BrowserProvider | null;
  signer: ethers.JsonRpcSigner | null;
  connectWallet: () => Promise<void>;
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
  PAPER_REGISTRY: '0x84eA74d481Ee0A5332c457a4d796187F6Ba67fEB',
  REVIEW_POOL: '0x9E545E3C0baAB3E08CdfD552C960A1050f373042',
  STAKE_MANAGER: '0xc3e53F4d16Ae77Db1c982e75a937B9f60FE63690',
};

// Contract ABIs (simplified for PoC)
export const PAPER_REGISTRY_ABI = [
  'function submitPaper(string calldata cid, string[] calldata keywords, string calldata fieldClassification, bool isEmbargoed, uint256 embargoEndTime) external payable returns (uint256)',
  'function getPaper(uint256 paperId) external view returns (tuple(string cid, address author, uint256 submissionTime, uint256 publicationFee, bool isPublished, uint256 totalScore, uint256 reviewCount, bool isEmbargoed, uint256 embargoEndTime, string[] keywords, string fieldClassification))',
  'function getAuthorPapers(address author) external view returns (uint256[])',
  'function publicationFee() external view returns (uint256)',
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
  'event ReviewersAssigned(uint256 indexed paperId, address[] reviewers)',
  'event ReviewSubmitted(uint256 indexed paperId, address indexed reviewer, bytes32 commentHash)'
];

export const STAKE_MANAGER_ABI = [
  'function stakeToBeReviewer() external',
  'function unstakeReviewer() external',
  'function getReviewer(address reviewer) external view returns (tuple(uint256 stake, uint256 reputation, bool isActive, uint256 lastActivityTime, uint256 reviewCount, uint256 successfulReviews))',
  'function balanceOf(address account) external view returns (uint256)',
  'function transfer(address to, uint256 amount) external returns (bool)',
  'function MIN_STAKE() external view returns (uint256)',
  'function claimFaucetTokens() external',
  'function hasClaimedFaucet(address account) external view returns (bool)',
  'event ReviewerStaked(address indexed reviewer, uint256 amount)'
];
