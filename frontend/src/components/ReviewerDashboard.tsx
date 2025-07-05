import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWeb3, CONTRACT_ADDRESSES, STAKE_MANAGER_ABI, REVIEW_POOL_ABI, PAPER_REGISTRY_ABI } from '../contexts/Web3Context';

interface Reviewer {
  stake: string;
  reputation: number;
  isActive: boolean;
  lastActivityTime: number;
  reviewCount: number;
  successfulReviews: number;
}

interface Review {
  paperId: number;
  reviewer: string;
  score: number;
  commentHash: string;
  encryptedComment: string;
  isRevealed: boolean;
  submitTime: number;
}

interface AssignedPaper {
  id: number;
  cid: string;
  author: string;
  deadline: number;
  hasSubmitted: boolean;
  hasRevealed: boolean;
  review?: Review;
}

const ReviewerDashboard: React.FC = () => {
  const { account, provider, signer } = useWeb3();
  const [reviewer, setReviewer] = useState<Reviewer | null>(null);
  const [assignedPapers, setAssignedPapers] = useState<AssignedPaper[]>([]);
  const [tokenBalance, setTokenBalance] = useState<string>('0');
  const [minStake, setMinStake] = useState<string>('0');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Review form state
  const [reviewForm, setReviewForm] = useState<{
    paperId: number | null;
    score: number;
    comment: string;
    showForm: boolean;
  }>({ paperId: null, score: 0, comment: '', showForm: false });

  useEffect(() => {
    if (account && provider) {
      loadReviewerData();
      loadTokenBalance();
      loadMinStake();
      loadAssignedPapers();
    }
  }, [account, provider]);

  const loadReviewerData = async () => {
    if (!account || !provider) return;
    
    try {
      const contract = new ethers.Contract(CONTRACT_ADDRESSES.STAKE_MANAGER, STAKE_MANAGER_ABI, provider);
      const reviewerData = await contract.getReviewer(account);
      
      setReviewer({
        stake: ethers.formatEther(reviewerData.stake),
        reputation: Number(reviewerData.reputation),
        isActive: reviewerData.isActive,
        lastActivityTime: Number(reviewerData.lastActivityTime),
        reviewCount: Number(reviewerData.reviewCount),
        successfulReviews: Number(reviewerData.successfulReviews)
      });
    } catch (err) {
      console.error('Error loading reviewer data:', err);
    }
  };

  const loadTokenBalance = async () => {
    if (!account || !provider) return;
    
    try {
      const contract = new ethers.Contract(CONTRACT_ADDRESSES.STAKE_MANAGER, STAKE_MANAGER_ABI, provider);
      const balance = await contract.balanceOf(account);
      setTokenBalance(ethers.formatEther(balance));
    } catch (err) {
      console.error('Error loading token balance:', err);
    }
  };

  const loadMinStake = async () => {
    if (!provider) return;
    
    try {
      const contract = new ethers.Contract(CONTRACT_ADDRESSES.STAKE_MANAGER, STAKE_MANAGER_ABI, provider);
      const minStake = await contract.MIN_STAKE();
      setMinStake(ethers.formatEther(minStake));
    } catch (err) {
      console.error('Error loading min stake:', err);
    }
  };

  const loadAssignedPapers = async () => {
    if (!account || !provider) return;
    
    setLoading(true);
    try {
      // This is a simplified implementation - in practice, you'd need to track assignments
      // For now, we'll just show an empty list
      setAssignedPapers([]);
    } catch (err) {
      setError('Failed to load assigned papers');
      console.error('Error loading assigned papers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStakeToReview = async () => {
    if (!signer) return;
    
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const contract = new ethers.Contract(CONTRACT_ADDRESSES.STAKE_MANAGER, STAKE_MANAGER_ABI, signer);
      const tx = await contract.stakeToBeReviewer();
      await tx.wait();
      
      setSuccess('Successfully staked to become a reviewer!');
      await loadReviewerData();
      await loadTokenBalance();
    } catch (err: any) {
      setError(err.message || 'Failed to stake');
      console.error('Error staking:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUnstake = async () => {
    if (!signer) return;
    
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const contract = new ethers.Contract(CONTRACT_ADDRESSES.STAKE_MANAGER, STAKE_MANAGER_ABI, signer);
      const tx = await contract.unstakeReviewer();
      await tx.wait();
      
      setSuccess('Successfully unstaked!');
      await loadReviewerData();
      await loadTokenBalance();
    } catch (err: any) {
      setError(err.message || 'Failed to unstake');
      console.error('Error unstaking:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signer || reviewForm.paperId === null) return;
    
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      // Create hash of comment
      const commentHash = ethers.keccak256(ethers.toUtf8Bytes(reviewForm.comment));
      
      const contract = new ethers.Contract(CONTRACT_ADDRESSES.REVIEW_POOL, REVIEW_POOL_ABI, signer);
      const tx = await contract.submitReview(
        reviewForm.paperId,
        reviewForm.score,
        commentHash,
        reviewForm.comment // In practice, this would be encrypted
      );
      
      await tx.wait();
      setSuccess('Review submitted successfully!');
      setReviewForm({ paperId: null, score: 0, comment: '', showForm: false });
      await loadAssignedPapers();
    } catch (err: any) {
      setError(err.message || 'Failed to submit review');
      console.error('Error submitting review:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRevealReview = async (paperId: number, score: number, comment: string) => {
    if (!signer) return;
    
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const contract = new ethers.Contract(CONTRACT_ADDRESSES.REVIEW_POOL, REVIEW_POOL_ABI, signer);
      const tx = await contract.revealReview(paperId, score, comment);
      await tx.wait();
      
      setSuccess('Review revealed successfully!');
      await loadAssignedPapers();
    } catch (err: any) {
      setError(err.message || 'Failed to reveal review');
      console.error('Error revealing review:', err);
    } finally {
      setLoading(false);
    }
  };

  const openReviewForm = (paperId: number) => {
    setReviewForm({
      paperId,
      score: 0,
      comment: '',
      showForm: true
    });
  };

  const closeReviewForm = () => {
    setReviewForm({ paperId: null, score: 0, comment: '', showForm: false });
  };

  if (!account) {
    return (
      <div className="card">
        <h2>Reviewer Dashboard</h2>
        <p>Please connect your wallet to access the reviewer dashboard.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="card">
        <h2>Reviewer Profile</h2>
        
        {error && <div className="error">{error}</div>}
        {success && <div className="success">{success}</div>}
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
          <div>
            <p><strong>Token Balance:</strong> {tokenBalance} PROOF</p>
            <p><strong>Min Stake Required:</strong> {minStake} PROOF</p>
          </div>
          
          {reviewer && (
            <div>
              <p><strong>Staked:</strong> {reviewer.stake} PROOF</p>
              <p><strong>Reputation:</strong> {reviewer.reputation}/100</p>
              <p><strong>Status:</strong> {reviewer.isActive ? 'Active' : 'Inactive'}</p>
              <p><strong>Reviews Completed:</strong> {reviewer.reviewCount}</p>
              <p><strong>Success Rate:</strong> {reviewer.reviewCount > 0 ? Math.round((reviewer.successfulReviews / reviewer.reviewCount) * 100) : 0}%</p>
            </div>
          )}
        </div>
        
        <div style={{ marginTop: '1rem' }}>
          {!reviewer || !reviewer.isActive ? (
            <button 
              className="button" 
              onClick={handleStakeToReview}
              disabled={loading || parseFloat(tokenBalance) < parseFloat(minStake)}
            >
              {loading ? 'Staking...' : 'Stake to Become Reviewer'}
            </button>
          ) : (
            <button 
              className="button secondary" 
              onClick={handleUnstake}
              disabled={loading}
            >
              {loading ? 'Unstaking...' : 'Unstake'}
            </button>
          )}
        </div>
        
        {parseFloat(tokenBalance) < parseFloat(minStake) && (
          <p style={{ color: '#c53030', marginTop: '1rem' }}>
            You need at least {minStake} PROOF tokens to stake as a reviewer.
          </p>
        )}
      </div>
      
      <div className="card">
        <h2>Assigned Papers</h2>
        
        {loading && <div className="loading">Loading assigned papers...</div>}
        
        {assignedPapers.length === 0 && !loading && (
          <p>You don't have any papers assigned for review at the moment.</p>
        )}
        
        {assignedPapers.map(paper => (
          <div key={paper.id} className="paper-card">
            <h3>Paper #{paper.id}</h3>
            <p><strong>CID:</strong> {paper.cid}</p>
            <p><strong>Author:</strong> {paper.author}</p>
            <p><strong>Deadline:</strong> {new Date(paper.deadline * 1000).toLocaleDateString()}</p>
            <p><strong>Status:</strong> 
              {paper.hasRevealed ? 'Revealed' : 
               paper.hasSubmitted ? 'Submitted (Pending Reveal)' : 'Pending Review'}
            </p>
            
            {!paper.hasSubmitted && (
              <button 
                className="button" 
                onClick={() => openReviewForm(paper.id)}
                disabled={loading}
              >
                Submit Review
              </button>
            )}
            
            {paper.hasSubmitted && !paper.hasRevealed && paper.review && (
              <button 
                className="button" 
                onClick={() => handleRevealReview(paper.id, paper.review!.score, paper.review!.encryptedComment)}
                disabled={loading}
              >
                Reveal Review
              </button>
            )}
          </div>
        ))}
      </div>
      
      {reviewForm.showForm && (
        <div className="card">
          <h2>Submit Review for Paper #{reviewForm.paperId}</h2>
          
          <form onSubmit={handleSubmitReview}>
            <div className="form-group">
              <label htmlFor="score">Score (-2 to +2)</label>
              <select
                id="score"
                value={reviewForm.score}
                onChange={(e) => setReviewForm(prev => ({ ...prev, score: parseInt(e.target.value) }))}
                required
              >
                <option value={-2}>-2 (Strongly Reject)</option>
                <option value={-1}>-1 (Reject)</option>
                <option value={0}>0 (Neutral)</option>
                <option value={1}>1 (Accept)</option>
                <option value={2}>2 (Strongly Accept)</option>
              </select>
            </div>
            
            <div className="form-group">
              <label htmlFor="comment">Review Comments</label>
              <textarea
                id="comment"
                value={reviewForm.comment}
                onChange={(e) => setReviewForm(prev => ({ ...prev, comment: e.target.value }))}
                placeholder="Provide detailed feedback on the paper..."
                required
                rows={6}
              />
            </div>
            
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button type="submit" className="button" disabled={loading}>
                {loading ? 'Submitting...' : 'Submit Review'}
              </button>
              <button type="button" className="button secondary" onClick={closeReviewForm}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default ReviewerDashboard;