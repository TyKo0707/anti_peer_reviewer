import { ethers } from "hardhat";

async function main() {
  const PAPER_REGISTRY_ADDRESS = "0x0DCd1Bf9A1b36cE34237eEaFef220932846BCD82";
  const REVIEW_POOL_ADDRESS = "0x9A676e781A523b5d0C0e43731313A708CB607508";
  
  const paperRegistry = await ethers.getContractAt("PaperRegistry", PAPER_REGISTRY_ADDRESS);
  
  console.log("=== Checking Authorization ===");
  
  // Check current state
  const owner = await paperRegistry.owner();
  const currentReviewPool = await paperRegistry.reviewPool();
  
  console.log("PaperRegistry owner:", owner);
  console.log("Current ReviewPool in PaperRegistry:", currentReviewPool);
  console.log("Expected ReviewPool:", REVIEW_POOL_ADDRESS);
  console.log("ReviewPool correctly set:", currentReviewPool.toLowerCase() === REVIEW_POOL_ADDRESS.toLowerCase());
  
  // Test direct call
  console.log("\n=== Testing Direct Authorization ===");
  try {
    // Call updatePaperScore as owner (should work)
    console.log("Testing owner call...");
    await paperRegistry.updatePaperScore(0, 1, { gasLimit: 100000 });
    console.log("✅ Owner call would work");
  } catch (e) {
    console.log("❌ Owner call would fail:", e.message);
  }
  
  // Check if the authorization logic in the contract is working
  console.log("\n=== Deployment Check ===");
  const code = await ethers.provider.getCode(PAPER_REGISTRY_ADDRESS);
  console.log("PaperRegistry has code:", code !== "0x");
  
  const reviewCode = await ethers.provider.getCode(REVIEW_POOL_ADDRESS);
  console.log("ReviewPool has code:", reviewCode !== "0x");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });