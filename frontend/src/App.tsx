import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ethers } from 'ethers';
import './App.css';

import Header from './components/Header';
import AuthorDashboard from './components/AuthorDashboard';
import ReviewerDashboard from './components/ReviewerDashboard';
import PublicReviews from './components/PublicReviews';
import Home from './components/Home';
import { Web3Provider } from './contexts/Web3Context';
import { useProviderReset } from "./hooks/useProviderReset";

// Expected network configuration
const EXPECTED_NETWORK = {
  chainId: '0x7a69', // 31337 in hex (Hardhat localhost)
  chainName: 'Localhost 8545',
  rpcUrls: ['http://localhost:8545'],
  nativeCurrency: {
    name: 'Ethereum',
    symbol: 'ETH',
    decimals: 18
  }
};

function App() {
  const [account, setAccount] = useState<string | null>(null);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null);
  const [isCorrectNetwork, setIsCorrectNetwork] = useState<boolean>(false);
  const [networkError, setNetworkError] = useState<string | null>(null);

  useProviderReset(provider);

  const checkNetwork = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const network = await provider.getNetwork();
        const chainId = '0x' + network.chainId.toString(16);
        
        if (chainId === EXPECTED_NETWORK.chainId) {
          setIsCorrectNetwork(true);
          setNetworkError(null);
          return true;
        } else {
          setIsCorrectNetwork(false);
          setNetworkError(`Wrong network. Expected: ${EXPECTED_NETWORK.chainName} (Chain ID: ${EXPECTED_NETWORK.chainId}), Got: Chain ID ${chainId}`);
          return false;
        }
      } catch (error) {
        console.error('Error checking network:', error);
        setIsCorrectNetwork(false);
        setNetworkError('Failed to check network');
        return false;
      }
    }
    return false;
  };

  const switchToCorrectNetwork = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        // Try to switch to the correct network
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: EXPECTED_NETWORK.chainId }],
        });
      } catch (switchError: any) {
        // If the network doesn't exist, add it
        if (switchError.code === 4902) {
          try {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [EXPECTED_NETWORK],
            });
          } catch (addError) {
            console.error('Error adding network:', addError);
          }
        } else {
          console.error('Error switching network:', switchError);
        }
      }
    }
  };

  const connectWallet = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        // First check if we're on the correct network
        const isCorrect = await checkNetwork();
        if (!isCorrect) {
          return; // Don't connect if network is wrong
        }

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

  const forceRefresh = () => {
    console.log('🔄 Force refreshing application...');
    window.location.reload();
  };

  useEffect(() => {
    // Check network on initial load
    checkNetwork();

    // Check if wallet is already connected
    if (typeof window.ethereum !== 'undefined') {
      window.ethereum.request({ method: 'eth_accounts' })
        .then((accounts: string[]) => {
          if (accounts.length > 0) {
            connectWallet();
          }
        });

      // Listen for account changes
      const handleAccountsChanged = (accounts: string[]) => {
        console.log('Accounts changed, refreshing page...');
        window.location.reload();
      };

      // Listen for network changes
      const handleChainChanged = (chainId: string) => {
        console.log('Network changed, refreshing page...');
        window.location.reload();
      };

      // Add event listeners
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);

      // Cleanup function
      return () => {
        if (window.ethereum?.removeListener) {
          window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
          window.ethereum.removeListener('chainChanged', handleChainChanged);
        }
      };
    }
  }, []);

  // If not on correct network, show network error
  if (!isCorrectNetwork) {
    return (
      <div className="App">
        <div className="card" style={{ 
          maxWidth: '600px', 
          margin: '2rem auto', 
          textAlign: 'center',
          padding: '2rem',
          border: '2px solid #e53e3e',
          backgroundColor: '#fed7d7'
        }}>
          <h2 style={{ color: '#c53030' }}>Wrong Network</h2>
          <p style={{ color: '#744210', marginBottom: '1rem' }}>
            {networkError || 'Please switch to the correct network to use this application.'}
          </p>
          <div style={{ marginBottom: '1rem' }}>
            <strong>Expected Network:</strong>
            <br />
            <code>{EXPECTED_NETWORK.chainName}</code>
            <br />
            <small>Chain ID: {EXPECTED_NETWORK.chainId}</small>
          </div>
          <button 
            className="button" 
            onClick={switchToCorrectNetwork}
            style={{ marginRight: '1rem' }}
          >
            Switch to {EXPECTED_NETWORK.chainName}
          </button>
          <button 
            className="button secondary" 
            onClick={checkNetwork}
          >
            Check Network Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <Web3Provider value={{ account, provider, signer, connectWallet, forceRefresh }}>
      <Router>
        <div className="App">
          <Header />
          <main className="main-content">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/author" element={<AuthorDashboard />} />
              <Route path="/reviewer" element={<ReviewerDashboard />} />
              <Route path="/reviews" element={<PublicReviews />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </Router>
    </Web3Provider>
  );
}

export default App;
