import React from 'react';
import { Link } from 'react-router-dom';
import { useWeb3 } from '../contexts/Web3Context';

const Home: React.FC = () => {
  const { account, connectWallet } = useWeb3();

  return (
    <div>
      <div className="home-hero">
        <h1>Decentralized Peer Review</h1>
        <p>A blockchain-based platform for transparent, incentivized academic peer review</p>
        {!account && (
          <button className="button" onClick={connectWallet}>
            Connect Wallet to Get Started
          </button>
        )}
      </div>
      
      <div className="role-cards">
        <div className="role-card">
          <h3>📝 Author</h3>
          <p>Submit your research papers for peer review. Pay a small fee to ensure serious submissions and get quality feedback from experts in your field.</p>
          <Link to="/author" className="button">Submit Paper</Link>
        </div>
        
        <div className="role-card">
          <h3>🔍 Reviewer</h3>
          <p>Stake tokens to become a reviewer. Earn rewards for providing timely, quality reviews and build your reputation in the academic community.</p>
          <Link to="/reviewer" className="button">Become Reviewer</Link>
        </div>
      </div>
      
      <div className="card">
        <h2>How It Works</h2>
        <ol>
          <li><strong>Submit:</strong> Authors upload papers with metadata and pay a publication fee</li>
          <li><strong>Review:</strong> VRF randomly assigns qualified reviewers based on stake and reputation</li>
          <li><strong>Evaluate:</strong> Reviewers submit encrypted reviews with scores (-2 to +2)</li>
          <li><strong>Reveal:</strong> After review period, reviewers reveal their comments</li>
          <li><strong>Decide:</strong> Papers are published as NFTs if they meet threshold scores</li>
          <li><strong>Reward:</strong> Reviewers earn tokens and reputation for quality work</li>
        </ol>
      </div>
    </div>
  );
};

export default Home;