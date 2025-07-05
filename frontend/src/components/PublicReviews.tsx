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
      const nextPaperId = await paperRegistry.nextPaperId();
      const totalPapers = Number(nextPaperId);
      
      if (totalPapers === 0) {
        setPapers([]);
        return;
      }
      
      // Load all papers
      const papersData: Paper[] = [];
      console.log(`Loading ${totalPapers} papers...`);
      
      for (let i = 0; i < totalPapers; i++) {
        try {
          const paper = await paperRegistry.getPaper(i);
          console.log(`Paper ${i}:`, {
            cid: paper.cid,
            isPublished: paper.isPublished,
            reviewCount: Number(paper.reviewCount),
            totalScore: Number(paper.totalScore)
          });
          
          // Check if paper is finalized
          let isFinalized = false;
          try {
            const assignment = await reviewPool.assignments(i);
            isFinalized = assignment[4]; // isCompleted field
            console.log(`Paper ${i} assignment:`, {
              paperId: Number(assignment[0]),
              reviewersCount: assignment[1].length,
              deadline: Number(assignment[2]),
              reviewCount: Number(assignment[3]),
              isCompleted: assignment[4]
            });
          } catch (err) {
            console.log(`No assignment found for paper ${i}:`, err);
            isFinalized = false;
          }
          
          console.log(`Paper ${i} isFinalized: ${isFinalized}`);
          
          // Include ALL papers for now to debug
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
        <div className="form-group">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'end' }}>
            <div style={{ flex: '1', minWidth: '250px' }}>
              <label htmlFor="search">Search Papers</label>
              <input
                id="search"
                type="text"
                placeholder="Search papers, fields, or keywords..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div>
              <label htmlFor="field-filter">Field</label>
              <select
                id="field-filter"
                value={filterField}
                onChange={(e) => setFilterField(e.target.value)}
              >
                <option value="">All Fields</option>
                {uniqueFields.map(field => (
                  <option key={field} value={field}>{field}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label htmlFor="status-filter">Status</label>
              <select
                id="status-filter"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="accepted">Accepted</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            
            <button
              onClick={loadAllPapers}
              disabled={loading}
              className="button"
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>
        
        {error && (
          <div className="error">
            {error}
          </div>
        )}
        
        {loading && (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <div className="loading">Loading papers...</div>
          </div>
        )}
        
        {!loading && filteredPapers.length === 0 && (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
            {papers.length === 0 
              ? "No papers found yet." 
              : "No papers match your search criteria."}
          </div>
        )}
        
        {/* Debug Section */}
        {papers.length > 0 && (
          <div style={{ 
            marginBottom: '1rem', 
            padding: '0.75rem', 
            backgroundColor: '#e6f3ff', 
            border: '1px solid #0066cc', 
            borderRadius: '4px', 
            fontSize: '0.9rem' 
          }}>
            <strong>Debug Info:</strong> Found {papers.length} total papers. 
            Finalized: {papers.filter(p => p.isFinalized).length}, 
            Published: {papers.filter(p => p.isPublished).length}
          </div>
        )}
        
        {filteredPapers.length > 0 && (
          <div>
            <div style={{ 
              fontSize: '0.9rem', 
              color: '#666', 
              marginBottom: '1rem' 
            }}>
              Showing {filteredPapers.length} of {papers.length} papers
            </div>
            
            {filteredPapers.map(paper => (
              <div key={paper.id} className="paper-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
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
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'flex-end', 
                    gap: '0.5rem' 
                  }}>
                    {getStatusBadge(paper)}
                    <button
                      onClick={() => setSelectedPaper(selectedPaper === paper.id ? null : paper.id)}
                      className="button secondary"
                      style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
                    >
                      {selectedPaper === paper.id ? 'Hide Reviews' : 'View Reviews'}
                    </button>
                  </div>
                </div>
                
                {/* Show reviews when selected */}
                {selectedPaper === paper.id && (
                  <div style={{ 
                    marginTop: '1rem', 
                    borderTop: '1px solid #ddd', 
                    paddingTop: '1rem' 
                  }}>
                    <ReviewsDisplay paperId={paper.id} />
                    <div style={{ 
                      marginTop: '1rem', 
                      padding: '0.75rem', 
                      backgroundColor: '#fff3cd', 
                      border: '1px solid #ffeaa7', 
                      borderRadius: '4px' 
                    }}>
                      <p style={{ fontSize: '0.9rem', color: '#856404', margin: 0 }}>
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