import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWeb3 } from '../contexts/Web3Context';
import { CONTRACT_ADDRESSES, DISPUTE_MANAGER_ABI, STAKE_MANAGER_ABI } from '../contexts/Web3Context';

interface DisputeFormProps {
  paperId: number;
  reviewerAddress: string;
  onClose: () => void;
  onSuccess: () => void;
}

const DisputeForm: React.FC<DisputeFormProps> = ({ paperId, reviewerAddress, onClose, onSuccess }) => {
  const { account, signer } = useWeb3();
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disputeStake, setDisputeStake] = useState<string>('');
  const [balance, setBalance] = useState<string>('0');
  const [needsApproval, setNeedsApproval] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    if (!signer || !account) return;

    try {
      const disputeManager = new ethers.Contract(CONTRACT_ADDRESSES.DISPUTE_MANAGER, DISPUTE_MANAGER_ABI, signer);
      const stakeManager = new ethers.Contract(CONTRACT_ADDRESSES.STAKE_MANAGER, STAKE_MANAGER_ABI, signer);

      // Get dispute stake requirement
      const stakeRequired = await disputeManager.DISPUTE_STAKE();
      setDisputeStake(ethers.formatEther(stakeRequired));

      // Get user's balance
      const userBalance = await stakeManager.balanceOf(account);
      setBalance(ethers.formatEther(userBalance));

      // Check if approval is needed
      const allowance = await stakeManager.allowance(account, CONTRACT_ADDRESSES.DISPUTE_MANAGER);
      setNeedsApproval(allowance < stakeRequired);

    } catch (err) {
      console.error('Error loading dispute data:', err);
      setError('Failed to load dispute information');
    }
  };

  const handleApprove = async () => {
    if (!signer) return;

    setLoading(true);
    setError(null);

    try {
      const stakeManager = new ethers.Contract(CONTRACT_ADDRESSES.STAKE_MANAGER, STAKE_MANAGER_ABI, signer);
      const disputeManager = new ethers.Contract(CONTRACT_ADDRESSES.DISPUTE_MANAGER, DISPUTE_MANAGER_ABI, signer);
      
      const stakeRequired = await disputeManager.DISPUTE_STAKE();
      
      const approveTx = await stakeManager.approve(CONTRACT_ADDRESSES.DISPUTE_MANAGER, stakeRequired);
      await approveTx.wait();
      
      setNeedsApproval(false);
    } catch (err: any) {
      setError(`Approval failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signer || !reason.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const disputeManager = new ethers.Contract(CONTRACT_ADDRESSES.DISPUTE_MANAGER, DISPUTE_MANAGER_ABI, signer);
      
      const tx = await disputeManager.createDispute(paperId, reviewerAddress, reason.trim());
      await tx.wait();
      
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(`Failed to create dispute: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const formatAddress = (address: string) => {
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  const hasEnoughBalance = parseFloat(balance) >= parseFloat(disputeStake);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div className="card" style={{ 
        width: '90%', 
        maxWidth: '500px', 
        margin: 0,
        maxHeight: '90vh',
        overflow: 'auto'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3>Dispute Review</h3>
          <button 
            onClick={onClose}
            style={{ 
              background: 'none', 
              border: 'none', 
              fontSize: '1.5rem', 
              cursor: 'pointer',
              color: '#666'
            }}
          >
            ×
          </button>
        </div>

        <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
          <p><strong>Paper ID:</strong> {paperId}</p>
          <p><strong>Reviewer:</strong> {formatAddress(reviewerAddress)}</p>
          <p><strong>Dispute Stake Required:</strong> {disputeStake} GO tokens</p>
          <p><strong>Your Balance:</strong> {balance} GO tokens</p>
        </div>

        {!hasEnoughBalance && (
          <div className="error" style={{ marginBottom: '1rem' }}>
            Insufficient balance. You need {disputeStake} GO tokens to file a dispute.
          </div>
        )}

        {error && (
          <div className="error" style={{ marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        {needsApproval && hasEnoughBalance ? (
          <div style={{ marginBottom: '1rem' }}>
            <p style={{ marginBottom: '1rem' }}>
              You need to approve the DisputeManager to spend {disputeStake} GO tokens.
            </p>
            <button 
              onClick={handleApprove}
              disabled={loading}
              className="button"
            >
              {loading ? 'Approving...' : `Approve ${disputeStake} GO`}
            </button>
          </div>
        ) : hasEnoughBalance ? (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="reason">Dispute Reason *</label>
              <textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain why you believe this review is unfair, inaccurate, or violates review guidelines..."
                required
                minLength={10}
                rows={4}
                style={{ width: '100%', resize: 'vertical' }}
              />
              <small style={{ color: '#666' }}>
                Minimum 10 characters. Be specific and provide evidence where possible.
              </small>
            </div>

            <div style={{ 
              marginTop: '1rem', 
              padding: '1rem', 
              backgroundColor: '#fff3cd', 
              border: '1px solid #ffeaa7', 
              borderRadius: '4px' 
            }}>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#856404' }}>
                <strong>Warning:</strong> Filing a dispute will stake {disputeStake} GO tokens. 
                If the dispute is found invalid by the jury, you will lose your stake. 
                If valid, you'll get your stake back plus a reward.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button 
                type="button" 
                onClick={onClose}
                className="button secondary"
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button 
                type="submit"
                disabled={loading || !reason.trim() || reason.length < 10}
                className="button"
                style={{ flex: 1 }}
              >
                {loading ? 'Creating Dispute...' : 'File Dispute'}
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </div>
  );
};

export default DisputeForm;