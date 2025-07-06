import hre from "hardhat";
import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  const { PRIVATE_KEY } = process.env;

  if (!PRIVATE_KEY) {
    throw new Error("Missing PRIVATE_KEY env var");
  }

  // Get signer from hardhat ethers
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));

  /* 1 ── StakeManager */
  console.log("\nDeploying StakeManager...");
  const StakeManagerFactory = await ethers.getContractFactory("StakeManager");
  const stakeManager = await StakeManagerFactory.deploy();
  await stakeManager.waitForDeployment();
  const stakeManagerAddress = await stakeManager.getAddress();
  console.log("StakeManager:", stakeManagerAddress);

  /* 2 ── PaperRegistry */
  console.log("\nDeploying PaperRegistry...");
  const PaperRegistryFactory = await ethers.getContractFactory("PaperRegistry");
  const paperRegistry = await PaperRegistryFactory.deploy();
  await paperRegistry.waitForDeployment();
  const paperRegistryAddress = await paperRegistry.getAddress();
  console.log("PaperRegistry:", paperRegistryAddress);

  /* 3 ── ReviewPool (no VRF needed) */
  console.log("\nDeploying ReviewPool...");
  const ReviewPoolFactory = await ethers.getContractFactory("ReviewPool");
  const reviewPool = await ReviewPoolFactory.deploy(
    stakeManagerAddress,
    paperRegistryAddress
  );
  await reviewPool.waitForDeployment();
  const reviewPoolAddress = await reviewPool.getAddress();
  console.log("ReviewPool:", reviewPoolAddress);

  /* 4 ── Set ReviewPool address in PaperRegistry */
  console.log("\nSetting ReviewPool address in PaperRegistry...");
  await paperRegistry.setReviewPool(reviewPoolAddress);
  console.log("ReviewPool address set in PaperRegistry");

  console.log("\n=== Deployment Summary ===");
  console.log("StakeManager:", stakeManagerAddress);
  console.log("PaperRegistry:", paperRegistryAddress);
  console.log("ReviewPool:", reviewPoolAddress);
  console.log("\nUpdate CONTRACT_ADDRESSES in frontend with these addresses.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Deployment failed:", err);
    process.exit(1);
  });

