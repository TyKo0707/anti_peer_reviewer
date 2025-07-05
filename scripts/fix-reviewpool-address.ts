import { ethers } from "hardhat";

async function main() {
  const PAPER_REGISTRY_ADDRESS = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";
  const REVIEW_POOL_ADDRESS = "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707";
  
  const paperRegistry = await ethers.getContractAt("PaperRegistry", PAPER_REGISTRY_ADDRESS);
  
  console.log("Setting ReviewPool address in PaperRegistry...");
  const tx = await paperRegistry.setReviewPool(REVIEW_POOL_ADDRESS);
  await tx.wait();
  
  console.log("✓ ReviewPool address set successfully");
  
  // Verify
  const setAddress = await paperRegistry.reviewPool();
  console.log("Verified ReviewPool address:", setAddress);
  console.log("Expected:", REVIEW_POOL_ADDRESS);
  console.log("Match:", setAddress.toLowerCase() === REVIEW_POOL_ADDRESS.toLowerCase());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });