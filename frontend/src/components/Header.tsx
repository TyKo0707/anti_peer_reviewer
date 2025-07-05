import React from 'react';
import { Link } from 'react-router-dom';
import { useWeb3 } from '../contexts/Web3Context';

const Header: React.FC = () => {
  const { account, connectWallet, forceRefresh } = useWeb3();

  return (
    <header className="header">
      <h1>Decentralized Peer Review</h1>
      <nav className="nav">
        <Link to="/">Home</Link>
        <Link to="/author">Author</Link>
        <Link to="/reviewer">Reviewer</Link>
        <Link to="/reviews">Reviews</Link>
        <button 
          className="wallet-button secondary" 
          onClick={forceRefresh}
          title="Refresh app if balances seem incorrect"
        >
          🔄
        </button>
        {account ? (
          <div className="wallet-button">
            {account.slice(0, 6)}...{account.slice(-4)}
          </div>
        ) : (
          <button className="wallet-button" onClick={connectWallet}>
            Connect Wallet
          </button>
        )}
      </nav>
    </header>
  );
};

export default Header;