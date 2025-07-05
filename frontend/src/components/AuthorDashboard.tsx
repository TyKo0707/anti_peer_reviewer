import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWeb3, CONTRACT_ADDRESSES, PAPER_REGISTRY_ABI } from '../contexts/Web3Context';

interface Paper {
  id: number;
  cid: string;
  author: string;
  submissionTime: number;
  publicationFee: string;
  isPublished: boolean;
  totalScore: number;
  reviewCount: number;
  isEmbargoed: boolean;
  embargoEndTime: number;
  keywords: string[];
  fieldClassification: string;
}

const AuthorDashboard: React.FC = () => {
  const { account, provider, signer } = useWeb3();
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [publicationFee, setPublicationFee] = useState<string>('0');
  
  // Form state
  const [formData, setFormData] = useState({
    cid: '',
    keywords: '',
    fieldClassification: '',
    isEmbargoed: false,
    embargoEndTime: ''
  });

  useEffect(() => {
    if (account && provider) {
      loadUserPapers();
      loadPublicationFee();
    }
  }, [account, provider]);

  const loadPublicationFee = async () => {
    if (!provider) return;
    
    try {
      const contract = new ethers.Contract(CONTRACT_ADDRESSES.PAPER_REGISTRY, PAPER_REGISTRY_ABI, provider);
      const fee = await contract.publicationFee();
      setPublicationFee(ethers.formatEther(fee));
    } catch (err) {
      console.error('Error loading publication fee:', err);
    }
  };

  const loadUserPapers = async () => {
    if (!account || !provider) return;
    
    setLoading(true);
    try {
      const contract = new ethers.Contract(CONTRACT_ADDRESSES.PAPER_REGISTRY, PAPER_REGISTRY_ABI, provider);
      const paperIds = await contract.getAuthorPapers(account);
      
      const papersData = await Promise.all(
        paperIds.map(async (id: bigint) => {
          const paper = await contract.getPaper(id);
          return {
            id: Number(id),
            cid: paper.cid,
            author: paper.author,
            submissionTime: Number(paper.submissionTime),
            publicationFee: ethers.formatEther(paper.publicationFee),
            isPublished: paper.isPublished,
            totalScore: Number(paper.totalScore),
            reviewCount: Number(paper.reviewCount),
            isEmbargoed: paper.isEmbargoed,
            embargoEndTime: Number(paper.embargoEndTime),
            keywords: paper.keywords,
            fieldClassification: paper.fieldClassification
          };
        })
      );
      
      setPapers(papersData);
    } catch (err) {
      setError('Failed to load papers');
      console.error('Error loading papers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleSubmitPaper = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signer || !formData.cid.trim()) return;
    
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const contract = new ethers.Contract(CONTRACT_ADDRESSES.PAPER_REGISTRY, PAPER_REGISTRY_ABI, signer);
      const keywords = formData.keywords.split(',').map(k => k.trim()).filter(k => k);
      const embargoEndTime = formData.isEmbargoed && formData.embargoEndTime ? 
        Math.floor(new Date(formData.embargoEndTime).getTime() / 1000) : 0;
      
      const fee = await contract.publicationFee();
      const tx = await contract.submitPaper(
        formData.cid,
        keywords,
        formData.fieldClassification,
        formData.isEmbargoed,
        embargoEndTime,
        { value: fee }
      );
      
      console.log('Transaction sent:', tx.hash);
      
      // Wait for transaction with timeout
      const receipt = await Promise.race([
        tx.wait(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Transaction timeout')), 30000)
        )
      ]);
      
      console.log('Transaction confirmed:', receipt);
      setSuccess('Paper submitted successfully!');
      setFormData({
        cid: '',
        keywords: '',
        fieldClassification: '',
        isEmbargoed: false,
        embargoEndTime: ''
      });
      
      // Reload papers
      await loadUserPapers();
    } catch (err: any) {
      setError(err.message || 'Failed to submit paper');
      console.error('Error submitting paper:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (paper: Paper) => {
    if (paper.isPublished) return <span className="status-badge published">Published</span>;
    if (paper.reviewCount === 0) return <span className="status-badge pending">Pending Assignment</span>;
    if (paper.reviewCount > 0 && paper.totalScore < 3) return <span className="status-badge rejected">Under Review</span>;
    return <span className="status-badge pending">Under Review</span>;
  };

  if (!account) {
    return (
      <div className="card">
        <h2>Author Dashboard</h2>
        <p>Please connect your wallet to access the author dashboard.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="card">
        <h2>Submit New Paper</h2>
        
        {error && <div className="error">{error}</div>}
        {success && <div className="success">{success}</div>}
        
        <form onSubmit={handleSubmitPaper}>
          <div className="form-group">
            <label htmlFor="cid">Paper CID (IPFS/AWS S3 link) *</label>
            <input
              type="text"
              id="cid"
              name="cid"
              value={formData.cid}
              onChange={handleInputChange}
              placeholder="QmXXXXXXX... or https://..."
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="keywords">Keywords (comma-separated)</label>
            <input
              type="text"
              id="keywords"
              name="keywords"
              value={formData.keywords}
              onChange={handleInputChange}
              placeholder="blockchain, peer review, decentralization"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="fieldClassification">Field Classification</label>
            <select
              id="fieldClassification"
              name="fieldClassification"
              value={formData.fieldClassification}
              onChange={handleInputChange}
            >
              <option value="">Select Field</option>
              <option value="Computer Science">Computer Science</option>
              <option value="Mathematics">Mathematics</option>
              <option value="Physics">Physics</option>
              <option value="Chemistry">Chemistry</option>
              <option value="Biology">Biology</option>
              <option value="Economics">Economics</option>
              <option value="Other">Other</option>
            </select>
          </div>
          
          <div className="form-group">
            <label>
              <input
                type="checkbox"
                name="isEmbargoed"
                checked={formData.isEmbargoed}
                onChange={handleInputChange}
              />
              Embargo paper (keep private until specified date)
            </label>
          </div>
          
          {formData.isEmbargoed && (
            <div className="form-group">
              <label htmlFor="embargoEndTime">Embargo End Date</label>
              <input
                type="datetime-local"
                id="embargoEndTime"
                name="embargoEndTime"
                value={formData.embargoEndTime}
                onChange={handleInputChange}
              />
            </div>
          )}
          
          <div className="form-group">
            <p><strong>Publication Fee:</strong> {publicationFee} ETH</p>
          </div>
          
          <button type="submit" className="button" disabled={loading || !formData.cid.trim()}>
            {loading ? 'Submitting...' : 'Submit Paper'}
          </button>
        </form>
      </div>
      
      <div className="card">
        <h2>My Papers</h2>
        
        {loading && <div className="loading">Loading papers...</div>}
        
        {papers.length === 0 && !loading && (
          <p>You haven't submitted any papers yet.</p>
        )}
        
        {papers.map(paper => (
          <div key={paper.id} className="paper-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3>Paper #{paper.id}</h3>
                <div className="paper-meta">
                  <p><strong>CID:</strong> {paper.cid}</p>
                  <p><strong>Field:</strong> {paper.fieldClassification}</p>
                  <p><strong>Keywords:</strong> {paper.keywords.join(', ')}</p>
                  <p><strong>Submitted:</strong> {new Date(paper.submissionTime * 1000).toLocaleDateString()}</p>
                  <p><strong>Reviews:</strong> {paper.reviewCount}</p>
                  <p><strong>Score:</strong> {paper.totalScore}</p>
                  {paper.isEmbargoed && (
                    <p><strong>Embargo until:</strong> {new Date(paper.embargoEndTime * 1000).toLocaleDateString()}</p>
                  )}
                </div>
              </div>
              {getStatusBadge(paper)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AuthorDashboard;