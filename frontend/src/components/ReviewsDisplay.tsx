import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWeb3 } from '../contexts/Web3Context';
import { CONTRACT_ADDRESSES, REVIEW_POOL_ABI } from '../contexts/Web3Context';

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
  const { provider } = useWeb3();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFinalized, setIsFinalized] = useState(false);

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
                </div>
                <span className="text-sm text-gray-500">
                  {formatDate(review.submitTime)}
                </span>
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
    </div>
  );
};

export default ReviewsDisplay;