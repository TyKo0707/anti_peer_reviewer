import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWeb3 } from '../contexts/Web3Context';
import { CONTRACT_ADDRESSES, REVIEW_POOL_ABI, DISPUTE_MANAGER_ABI } from '../contexts/Web3Context';
import DisputeForm from './DisputeForm';

interface Review {
  reviewer: string;
  score: number;
  comment: string;
  submitTime: number;
}

interface ReviewsDisplayProps {
  paperId: number;
  isVisible?: boolean;
}

const ReviewsDisplay: React.FC<ReviewsDisplayProps> = ({ paperId, isVisible = true }) => {
  const { provider, account } = useWeb3();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFinalized, setIsFinalized] = useState(false);
  const [disputes, setDisputes] = useState<{ [key: string]: number }>({});
  const [showDisputeForm, setShowDisputeForm] = useState<{ paperId: number; reviewer: string } | null>(null);

  const loadReviews = async () => {
    if (!provider) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const reviewPool = new ethers.Contract(CONTRACT_ADDRESSES.REVIEW_POOL, REVIEW_POOL_ABI, provider);
      
      // Check if paper is finalized and get reviews
      const [reviewers, scores, comments, submitTimes, finalized] = await reviewPool.getReviewsForPaper(paperId);
      
      setIsFinalized(finalized);
      
      const reviewsData: Review[] = [];
      for (let i = 0; i < reviewers.length; i++) {
        reviewsData.push({
          reviewer: reviewers[i],
          score: scores[i],
          comment: comments[i],
          submitTime: Number(submitTimes[i])
        });
      }
      
      setReviews(reviewsData);
      
      // Load dispute information for each review
      if (finalized) {
        await loadDisputeData(reviewsData);
      }
    } catch (err: any) {
      if (err.message.includes('Reviews not yet visible')) {
        setError('Reviews will be visible after the paper is finalized');
      } else {
        setError(`Failed to load reviews: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadDisputeData = async (reviewsData: Review[]) => {
    if (!provider) return;

    try {
      const disputeManager = new ethers.Contract(CONTRACT_ADDRESSES.DISPUTE_MANAGER, DISPUTE_MANAGER_ABI, provider);
      const disputeData: { [key: string]: number } = {};

      for (const review of reviewsData) {
        try {
          const disputeId = await disputeManager.getDisputeForReview(paperId, review.reviewer);
          if (disputeId > 0) {
            disputeData[review.reviewer] = Number(disputeId);
          }
        } catch (err) {
          // No dispute exists for this review
        }
      }

      setDisputes(disputeData);
    } catch (err) {
      console.error('Error loading dispute data:', err);
    }
  };

  useEffect(() => {
    if (isVisible) {
      loadReviews();
    }
  }, [paperId, provider, isVisible]);

  const formatAddress = (address: string) => {
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const getScoreColor = (score: number) => {
    if (score >= 1) return 'text-green-600';
    if (score === 0) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreText = (score: number) => {
    const scoreMap: { [key: number]: string } = {
      2: 'Strong Accept',
      1: 'Accept',
      0: 'Neutral',
      [-1]: 'Reject',
      [-2]: 'Strong Reject'
    };
    return scoreMap[score] || `Score: ${score}`;
  };

  if (!isVisible) return null;

  return (
    <div className="mt-4 p-4 bg-gray-50 rounded-lg">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold">Reviews</h3>
        <button
          onClick={loadReviews}
          disabled={loading}
          className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 disabled:bg-gray-400"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="mb-3 p-3 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded">
          {error}
        </div>
      )}

      {!error && reviews.length === 0 && !loading && (
        <div className="text-gray-500 text-center py-4">
          No reviews available yet
        </div>
      )}

      {reviews.length > 0 && (
        <div className="space-y-4">
          {reviews.map((review, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4 bg-white">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center space-x-3">
                  <span className="font-mono text-sm text-gray-600">
                    {formatAddress(review.reviewer)}
                  </span>
                  <span className={`font-semibold ${getScoreColor(review.score)}`}>
                    {getScoreText(review.score)}
                  </span>
                  {disputes[review.reviewer] && (
                    <span style={{ 
                      fontSize: '0.75rem', 
                      padding: '0.25rem 0.5rem', 
                      backgroundColor: '#ffeaa7', 
                      color: '#856404', 
                      borderRadius: '4px',
                      border: '1px solid #ffd93d'
                    }}>
                      Disputed #{disputes[review.reviewer]}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="text-sm text-gray-500">
                    {formatDate(review.submitTime)}
                  </span>
                  {account && account !== review.reviewer && !disputes[review.reviewer] && (
                    <button
                      onClick={() => setShowDisputeForm({ paperId, reviewer: review.reviewer })}
                      style={{
                        fontSize: '0.75rem',
                        padding: '0.25rem 0.5rem',
                        backgroundColor: '#ff6b6b',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                      title="Dispute this review"
                    >
                      Dispute
                    </button>
                  )}
                </div>
              </div>
              
              {review.comment && (
                <div className="mt-2 p-3 bg-gray-50 rounded border-l-4 border-gray-300">
                  <p className="text-gray-700 whitespace-pre-wrap">{review.comment}</p>
                </div>
              )}
            </div>
          ))}
          
          <div className="mt-4 text-sm text-gray-600 text-center">
            {reviews.length} review{reviews.length !== 1 ? 's' : ''} • Paper is finalized
          </div>
        </div>
      )}

      {/* Dispute Form Modal */}
      {showDisputeForm && (
        <DisputeForm
          paperId={showDisputeForm.paperId}
          reviewerAddress={showDisputeForm.reviewer}
          onClose={() => setShowDisputeForm(null)}
          onSuccess={() => {
            loadReviews(); // Reload to show new dispute
          }}
        />
      )}
    </div>
  );
};

export default ReviewsDisplay;