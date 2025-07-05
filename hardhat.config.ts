import "@matterlabs/hardhat-zksync-solc";
import "@matterlabs/hardhat-zksync-deploy";
import "@nomicfoundation/hardhat-ethers";

export default {
  zksolc: { version: "1.4.0", compilerSource: "binary" },
  solidity: { version: "0.8.24" },
  networks: {
    zkSyncTestnet: {
      url: "https://sepolia.era.zksync.dev",
      ethNetwork: "sepolia",
      zksync: true,
    },
  },
};

