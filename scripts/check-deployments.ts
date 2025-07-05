import { ethers } from "hardhat";

async function main() {
  console.log("=== Checking Current Deployments ===");
  
  // Check current block
  const blockNumber = await ethers.provider.getBlockNumber();
  console.log("Current block number:", blockNumber);
  
  // These are the addresses the frontend is trying to use
  const addresses = {
    STAKE_MANAGER: "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707",
    PAPER_REGISTRY: "0x0165878A594ca255338adfa4d48449f69242Eb8F",
    REVIEW_POOL: "0xa513E6E4b8f2a923D98304ec87F64353C4D5C853"
  };
  
  console.log("\nChecking if contracts exist at these addresses:");
  
  for (const [name, address] of Object.entries(addresses)) {
    try {
      const code = await ethers.provider.getCode(address);
      const exists = code !== "0x";
      console.log(`${name}: ${address} - ${exists ? "✅ Contract exists" : "❌ No contract"}`);
      
      if (exists && name === "STAKE_MANAGER") {
        // Try to call a simple function
        try {
          const contract = await ethers.getContractAt("StakeManager", address);
          const minStake = await contract.MIN_STAKE();
          console.log(`  Min stake: ${ethers.formatEther(minStake)} GO`);
        } catch (e) {
          console.log(`  ❌ Error calling function: ${e.message}`);
        }
      }
    } catch (e) {
      console.log(`${name}: ${address} - ❌ Error checking: ${e.message}`);
    }
  }
  
  console.log("\n=== Current Network Info ===");
  const network = await ethers.provider.getNetwork();
  console.log("Chain ID:", network.chainId.toString());
  console.log("Network name:", network.name);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });