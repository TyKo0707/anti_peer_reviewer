import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ethers } from 'ethers';
import './App.css';

import Header from './components/Header';
import AuthorDashboard from './components/AuthorDashboard';
import ReviewerDashboard from './components/ReviewerDashboard';
import Home from './components/Home';
import { Web3Provider } from './contexts/Web3Context';
import { useProviderReset } from "./hooks/useProviderReset";

function App() {
  const [account, setAccount] = useState<string | null>(null);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null);

  useProviderReset(provider);

  const connectWallet = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        await provider.send('eth_requestAccounts', []);
        const signer = await provider.getSigner();
        const address = await signer.getAddress();
        
        setProvider(provider);
        setSigner(signer);
        setAccount(address);
      } catch (error) {
        console.error('Error connecting wallet:', error);
      }
    } else {
      alert('Please install MetaMask to use this application');
    }
  };

  useEffect(() => {
    // Check if wallet is already connected
    if (typeof window.ethereum !== 'undefined') {
      window.ethereum.request({ method: 'eth_accounts' })
        .then((accounts: string[]) => {
          if (accounts.length > 0) {
            connectWallet();
          }
        });
    }
  }, []);

  return (
    <Web3Provider value={{ account, provider, signer, connectWallet }}>
      <Router>
        <div className="App">
          <Header />
          <main className="main-content">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/author" element={<AuthorDashboard />} />
              <Route path="/reviewer" element={<ReviewerDashboard />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </Router>
    </Web3Provider>
  );
}

export default App;
