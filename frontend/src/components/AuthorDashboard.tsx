import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { useWeb3, CONTRACT_ADDRESSES, PAPER_REGISTRY_ABI, REVIEW_POOL_ABI } from '../contexts/Web3Context';
import ReviewsDisplay from './ReviewsDisplay';

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
  isFinalized: boolean;
}

const AuthorDashboard: React.FC = () => {
  const { account, provider, signer } = useWeb3();
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [publicationFee, setPublicationFee] = useState<string>('0');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfValidationResult, setPdfValidationResult] = useState<{ valid: boolean, reason?: string } | null>(null);

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
      const reviewPoolContract = new ethers.Contract(CONTRACT_ADDRESSES.REVIEW_POOL, REVIEW_POOL_ABI, provider);
      const paperIds = await contract.getAuthorPapers(account);

      const papersData = await Promise.all(
        paperIds.map(async (id: bigint) => {
          const paper = await contract.getPaper(id);

          // Check if paper is finalized
          let isFinalized = false;
          try {
            const assignment = await reviewPoolContract.assignments(id);
            isFinalized = assignment[4]; // isCompleted field
          } catch (err) {
            // If error, assume not finalized
            isFinalized = false;
          }

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
            fieldClassification: paper.fieldClassification,
            isFinalized: isFinalized
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

  const uploadToS3 = async (file: File): Promise<string> => {
    const s3 = new S3Client({
      region: process.env.REACT_APP_AWS_REGION!,
      credentials: {
        accessKeyId: process.env.REACT_APP_AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.REACT_APP_AWS_SECRET_ACCESS_KEY!,
      },
    });

    const key = `papers/${Date.now()}_${file.name}`;

    const command = new PutObjectCommand({
      Bucket: process.env.REACT_APP_S3_BUCKET!,
      Key: key,
      Body: file,
      ContentType: 'application/pdf',
      ACL: 'public-read',
    });

    await s3.send(command);

    return `https://${process.env.REACT_APP_S3_BUCKET!}.s3.${process.env.REACT_APP_AWS_REGION!}.amazonaws.com/${key}`;
  };

  const validatePDF = async (file: File): Promise<{ valid: boolean; reason?: string }> => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("http://localhost:8000/validate", {
      method: "POST",
      body: formData,
    });

    return await response.json();
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
    if (!signer || !formData.cid.trim() || !pdfFile) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const validation = await validatePDF(pdfFile);
      if (!validation.valid) {
        setError(`Validation failed: ${validation.reason || 'Unknown issue'}`);
        setLoading(false);
        return;
      }

      // Upload to S3
      const uploadedUrl = await uploadToS3(pdfFile);
      setFormData(prev => ({ ...prev, cid: uploadedUrl }));

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
    if (paper.isPublished) return <span className="status-badge published">Accepted</span>;
    if (paper.isFinalized && !paper.isPublished) return <span className="status-badge rejected">Rejected</span>;
    if (paper.reviewCount === 0) return <span className="status-badge pending">Pending Assignment</span>;
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

        <div className="form-group">
          <label htmlFor="pdfFile">Upload PDF *</label>
          <input
            type="file"
            id="pdfFile"
            accept="application/pdf"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file && file.type === "application/pdf") {
                setPdfFile(file);
                try {
                  const result = await validatePDF(file);
                  setPdfValidationResult(result);  // You need to add this state: const [pdfValidationResult, setPdfValidationResult] = useState(null);
                } catch (err) {
                  setPdfValidationResult({ valid: false, reason: 'Validation server error' });
                }
              } else {
                setPdfValidationResult(null);
              }
            }}
          />
          {pdfValidationResult && (
            <div style={{ marginTop: '0.5rem' }}>
              {pdfValidationResult.valid ? (
                <span style={{ color: 'green' }}>✅ PDF format looks valid.</span>
              ) : (
                <span style={{ color: 'red' }}>❌ Invalid format: {pdfValidationResult.reason}</span>
              )}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmitPaper}>
          <div className="form-group">
            <label htmlFor="cid">Paper CID (IPFS/AWS S3 link) </label>
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
                  <p><strong>PDF:</strong> <a href={paper.cid} target="_blank" rel="noreferrer">Download</a></p>
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

            {/* Show reviews for finalized papers */}
            {paper.isFinalized && (
              <ReviewsDisplay paperId={paper.id} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AuthorDashboard;