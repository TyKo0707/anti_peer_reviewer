import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWeb3 } from '../contexts/Web3Context';
import { CONTRACT_ADDRESSES, DISPUTE_MANAGER_ABI, REVIEW_POOL_ABI } from '../contexts/Web3Context';

interface Dispute {
  disputeId: number;
  paperId: number;
  reviewerBeingDisputed: string;
  disputer: string;
  reason: string;
  disputeStake: string;
  createdTime: number;
  votingDeadline: number;
  status: number; // 0=Pending, 1=Voting, 2=Resolved, 3=Rejected
  votesFor: number;
  votesAgainst: number;
  jurors: string[];
  isJuror: boolean;
  hasVoted: boolean;
}

const DisputesPanel: React.FC = () => {
  const { account, provider, signer } = useWeb3();
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [votingLoading, setVotingLoading] = useState<{ [key: number]: boolean }>({});

  useEffect(() => {
    if (account && provider) {
      loadDisputes();
    }
  }, [account, provider]);

  const loadDisputes = async () => {
    if (!provider || !account) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const disputeManager = new ethers.Contract(CONTRACT_ADDRESSES.DISPUTE_MANAGER, DISPUTE_MANAGER_ABI, provider);
      
      // Get active disputes
      const activeDisputeIds = await disputeManager.getActiveDisputes();
      
      const disputesData: Dispute[] = [];
      
      for (const disputeId of activeDisputeIds) {
        try {
          const [
            paperId, reviewerBeingDisputed, disputer, reason, 
            disputeStake, createdTime, votingDeadline, status, 
            votesFor, votesAgainst, jurors
          ] = await disputeManager.getDispute(disputeId);
          
          // Check if current user is a juror and has voted
          const isJuror = await disputeManager.isJurorForDispute(disputeId, account);
          const hasVoted = isJuror ? await disputeManager.hasVotedOnDispute(disputeId, account) : false;
          
          disputesData.push({
            disputeId: Number(disputeId),
            paperId: Number(paperId),
            reviewerBeingDisputed,
            disputer,
            reason,
            disputeStake: ethers.formatEther(disputeStake),
            createdTime: Number(createdTime),
            votingDeadline: Number(votingDeadline),
            status: Number(status),
            votesFor: Number(votesFor),
            votesAgainst: Number(votesAgainst),
            jurors,
            isJuror,
            hasVoted
          });
        } catch (err) {
          console.error(`Error loading dispute ${disputeId}:`, err);
        }
      }
      
      setDisputes(disputesData);
    } catch (err: any) {
      setError(`Failed to load disputes: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (disputeId: number, supportDispute: boolean) => {
    if (!signer) return;
    
    setVotingLoading(prev => ({ ...prev, [disputeId]: true }));
    setError(null);
    
    try {
      const disputeManager = new ethers.Contract(CONTRACT_ADDRESSES.DISPUTE_MANAGER, DISPUTE_MANAGER_ABI, signer);
      
      const tx = await disputeManager.voteOnDispute(disputeId, supportDispute);
      await tx.wait();
      
      // Reload disputes to show updated status
      await loadDisputes();
    } catch (err: any) {
      setError(`Failed to vote: ${err.message}`);
    } finally {
      setVotingLoading(prev => ({ ...prev, [disputeId]: false }));
    }
  };

  const formatAddress = (address: string) => {
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const getStatusText = (status: number) => {
    switch (status) {
      case 0: return 'Pending';
      case 1: return 'Voting';
      case 2: return 'Resolved';
      case 3: return 'Rejected';
      default: return 'Unknown';
    }
  };

  const getStatusColor = (status: number) => {
    switch (status) {
      case 0: return '#ffeaa7';
      case 1: return '#74b9ff';
      case 2: return '#00b894';
      case 3: return '#fd79a8';
      default: return '#ddd';
    }
  };

  const isVotingActive = (dispute: Dispute) => {
    return dispute.status === 1 && Date.now() / 1000 < dispute.votingDeadline;
  };

  if (!account) {
    return (
      <div className="card">
        <h3>Disputes</h3>
        <p>Please connect your wallet to view disputes.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3>Active Disputes</h3>
        <button
          onClick={loadDisputes}
          disabled={loading}
          className="button secondary"
          style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Debug info */}
      {account && (
        <div style={{ 
          marginBottom: '1rem', 
          padding: '0.75rem', 
          backgroundColor: '#e6f3ff', 
          border: '1px solid #0066cc', 
          borderRadius: '4px', 
          fontSize: '0.85rem' 
        }}>
          <strong>Debug:</strong> Your address: {formatAddress(account)}
          {disputes.length > 0 && (
            <div>
              {disputes.map(d => (
                <div key={d.disputeId}>
                  Dispute #{d.disputeId}: Status={d.status}, IsJuror={d.isJuror.toString()}, HasVoted={d.hasVoted.toString()}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="error" style={{ marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <div className="loading">Loading disputes...</div>
        </div>
      )}

      {!loading && disputes.length === 0 && (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
          No active disputes at the moment.
        </div>
      )}

      {disputes.length > 0 && (
        <div>
          <div style={{ 
            fontSize: '0.9rem', 
            color: '#666', 
            marginBottom: '1rem' 
          }}>
            {disputes.length} active dispute{disputes.length !== 1 ? 's' : ''}
          </div>
          
          {disputes.map(dispute => (
            <div key={dispute.disputeId} className="paper-card">
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <h4>Dispute #{dispute.disputeId}</h4>
                  <span style={{ 
                    fontSize: '0.8rem', 
                    padding: '0.25rem 0.75rem', 
                    backgroundColor: getStatusColor(dispute.status), 
                    color: 'white', 
                    borderRadius: '12px' 
                  }}>
                    {getStatusText(dispute.status)}
                  </span>
                </div>
                
                <div className="paper-meta">
                  <p><strong>Paper ID:</strong> {dispute.paperId}</p>
                  <p><strong>Disputed Reviewer:</strong> {formatAddress(dispute.reviewerBeingDisputed)}</p>
                  <p><strong>Disputer:</strong> {formatAddress(dispute.disputer)}</p>
                  <p><strong>Stake:</strong> {dispute.disputeStake} GO</p>
                  <p><strong>Created:</strong> {formatDate(dispute.createdTime)}</p>
                  {dispute.status === 1 && (
                    <p><strong>Voting Deadline:</strong> {formatDate(dispute.votingDeadline)}</p>
                  )}
                </div>
              </div>

              <div style={{ 
                marginBottom: '1rem', 
                padding: '1rem', 
                backgroundColor: '#f8f9fa', 
                borderRadius: '4px',
                borderLeft: '4px solid #007bff'
              }}>
                <p style={{ margin: 0, fontWeight: 'bold', marginBottom: '0.5rem' }}>Reason:</p>
                <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{dispute.reason}</p>
              </div>

              {dispute.status === 1 && (
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span><strong>Votes:</strong> For: {dispute.votesFor}, Against: {dispute.votesAgainst}</span>
                    <span><strong>Jurors:</strong> {dispute.jurors.length}</span>
                  </div>
                  
                  {dispute.isJuror && (
                    <div style={{ 
                      padding: '1rem', 
                      backgroundColor: isVotingActive(dispute) ? '#e8f5e8' : '#f8f9fa', 
                      borderRadius: '4px',
                      border: `1px solid ${isVotingActive(dispute) ? '#28a745' : '#ddd'}`
                    }}>
                      {dispute.hasVoted ? (
                        <p style={{ margin: 0, color: '#28a745' }}>
                          ✓ You have already voted on this dispute
                        </p>
                      ) : isVotingActive(dispute) ? (
                        <div>
                          <p style={{ margin: '0 0 1rem 0', fontWeight: 'bold' }}>
                            You are selected as a juror. Please vote:
                          </p>
                          <div style={{ display: 'flex', gap: '1rem' }}>
                            <button
                              onClick={() => handleVote(dispute.disputeId, true)}
                              disabled={votingLoading[dispute.disputeId]}
                              className="button"
                              style={{ backgroundColor: '#28a745' }}
                            >
                              {votingLoading[dispute.disputeId] ? 'Voting...' : 'Support Dispute'}
                            </button>
                            <button
                              onClick={() => handleVote(dispute.disputeId, false)}
                              disabled={votingLoading[dispute.disputeId]}
                              className="button"
                              style={{ backgroundColor: '#dc3545' }}
                            >
                              {votingLoading[dispute.disputeId] ? 'Voting...' : 'Reject Dispute'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p style={{ margin: 0, color: '#856404' }}>
                          Voting period has expired. The dispute will be resolved automatically.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DisputesPanel;