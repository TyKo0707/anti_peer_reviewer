import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWeb3 } from '../contexts/Web3Context';
import { CONTRACT_ADDRESSES, PAPER_REGISTRY_ABI, REVIEW_POOL_ABI } from '../contexts/Web3Context';
import ReviewsDisplay from './ReviewsDisplay';

interface Paper {
  id: number;
  cid: string;
  author: string;
  submissionTime: number;
  isPublished: boolean;
  totalScore: number;
  reviewCount: number;
  keywords: string[];
  fieldClassification: string;
  isFinalized: boolean;
}

const PublicReviews: React.FC = () => {
  const { provider } = useWeb3();
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPaper, setSelectedPaper] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterField, setFilterField] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    if (provider) {
      loadAllPapers();
    }
  }, [provider]);

  const loadAllPapers = async () => {
    if (!provider) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const paperRegistry = new ethers.Contract(CONTRACT_ADDRESSES.PAPER_REGISTRY, PAPER_REGISTRY_ABI, provider);
      const reviewPool = new ethers.Contract(CONTRACT_ADDRESSES.REVIEW_POOL, REVIEW_POOL_ABI, provider);
      
      // Get next paper ID to know how many papers exist
      const nextPaperId = await paperRegistry.nextPaperId;
      const totalPapers = Number(nextPaperId);
      
      if (totalPapers === 0) {
        setPapers([]);
        return;
      }
      
      // Load all papers
      const papersData: Paper[] = [];
      for (let i = 0; i < totalPapers; i++) {
        try {
          const paper = await paperRegistry.getPaper(i);
          
          // Check if paper is finalized
          let isFinalized = false;
          try {
            const assignment = await reviewPool.assignments(i);
            isFinalized = assignment[4]; // isCompleted field
          } catch (err) {
            // If error, assume not finalized
            isFinalized = false;
          }
          
          // Only include finalized papers (where reviews are visible)
          if (isFinalized) {
            papersData.push({
              id: i,
              cid: paper.cid,
              author: paper.author,
              submissionTime: Number(paper.submissionTime),
              isPublished: paper.isPublished,
              totalScore: Number(paper.totalScore),
              reviewCount: Number(paper.reviewCount),
              keywords: paper.keywords,
              fieldClassification: paper.fieldClassification,
              isFinalized: isFinalized
            });
          }
        } catch (err) {
          console.error(`Error loading paper ${i}:`, err);
        }
      }
      
      // Sort by submission time (newest first)
      papersData.sort((a, b) => b.submissionTime - a.submissionTime);
      
      setPapers(papersData);
    } catch (err: any) {
      setError(`Failed to load papers: ${err.message}`);
      console.error('Error loading papers:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatAddress = (address: string) => {
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  const getStatusBadge = (paper: Paper) => {
    if (paper.isPublished) return <span className="status-badge published">Accepted</span>;
    return <span className="status-badge rejected">Rejected</span>;
  };

  const filteredPapers = papers.filter(paper => {
    const matchesSearch = !searchTerm || 
      paper.cid.toLowerCase().includes(searchTerm.toLowerCase()) ||
      paper.fieldClassification.toLowerCase().includes(searchTerm.toLowerCase()) ||
      paper.keywords.some(keyword => keyword.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesField = !filterField || paper.fieldClassification === filterField;
    
    const matchesStatus = filterStatus === 'all' || 
      (filterStatus === 'accepted' && paper.isPublished) ||
      (filterStatus === 'rejected' && !paper.isPublished);
    
    return matchesSearch && matchesField && matchesStatus;
  });

  const uniqueFields = Array.from(new Set(papers.map(p => p.fieldClassification))).filter(Boolean);

  return (
    <div>
      <div className="card">
        <h2>Public Reviews</h2>
        <p>Browse all finalized papers and their reviews. Reviews are visible to promote transparency and enable dispute resolution.</p>
        
        {/* Search and Filter Controls */}
        <div className="mb-4 space-y-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-64">
              <input
                type="text"
                placeholder="Search papers, fields, or keywords..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <select
              value={filterField}
              onChange={(e) => setFilterField(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Fields</option>
              {uniqueFields.map(field => (
                <option key={field} value={field}>{field}</option>
              ))}
            </select>
            
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
            </select>
            
            <button
              onClick={loadAllPapers}
              disabled={loading}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-400"
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>
        
        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}
        
        {loading && (
          <div className="text-center py-8">
            <div className="loading">Loading papers...</div>
          </div>
        )}
        
        {!loading && filteredPapers.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            {papers.length === 0 
              ? "No finalized papers with public reviews yet." 
              : "No papers match your search criteria."}
          </div>
        )}
        
        {filteredPapers.length > 0 && (
          <div className="space-y-4">
            <div className="text-sm text-gray-600 mb-4">
              Showing {filteredPapers.length} of {papers.length} finalized papers
            </div>
            
            {filteredPapers.map(paper => (
              <div key={paper.id} className="paper-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div className="flex-1">
                    <h3>Paper #{paper.id}</h3>
                    <div className="paper-meta">
                      <p><strong>CID:</strong> {paper.cid}</p>
                      <p><strong>Author:</strong> {formatAddress(paper.author)}</p>
                      <p><strong>Field:</strong> {paper.fieldClassification}</p>
                      <p><strong>Keywords:</strong> {paper.keywords.join(', ')}</p>
                      <p><strong>Submitted:</strong> {new Date(paper.submissionTime * 1000).toLocaleDateString()}</p>
                      <p><strong>Reviews:</strong> {paper.reviewCount}</p>
                      <p><strong>Score:</strong> {paper.totalScore}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {getStatusBadge(paper)}
                    <button
                      onClick={() => setSelectedPaper(selectedPaper === paper.id ? null : paper.id)}
                      className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
                    >
                      {selectedPaper === paper.id ? 'Hide Reviews' : 'View Reviews'}
                    </button>
                  </div>
                </div>
                
                {/* Show reviews when selected */}
                {selectedPaper === paper.id && (
                  <div className="mt-4 border-t pt-4">
                    <ReviewsDisplay paperId={paper.id} />
                    <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                      <p className="text-sm text-yellow-800">
                        <strong>Dispute Process:</strong> If you believe a review is unfair or inaccurate, 
                        you can contact the paper author or platform administrators. 
                        All reviews are permanent and transparent to ensure accountability.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PublicReviews;