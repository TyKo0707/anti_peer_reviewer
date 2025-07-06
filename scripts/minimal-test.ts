import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  const STAKE_MANAGER_ADDRESS = "0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0";
  const PAPER_REGISTRY_ADDRESS = "0x0DCd1Bf9A1b36cE34237eEaFef220932846BCD82";
  const REVIEW_POOL_ADDRESS = "0x9A676e781A523b5d0C0e43731313A708CB607508";
  
  const stakeManager = await ethers.getContractAt("StakeManager", STAKE_MANAGER_ADDRESS);
  const paperRegistry = await ethers.getContractAt("PaperRegistry", PAPER_REGISTRY_ADDRESS);
  const reviewPool = await ethers.getContractAt("ReviewPool", REVIEW_POOL_ADDRESS);
  
  console.log("=== Minimal Test ===");
  
  try {
    // 1. Make deployer a reviewer
    console.log("1. Setting up reviewer...");
    
    // Check if already a reviewer
    const reviewer = await stakeManager.getReviewer(deployer.address);
    if (!reviewer.isActive) {
      // Claim faucet if needed
      const hasClaimedFaucet = await stakeManager.hasClaimedFaucet(deployer.address);
      if (!hasClaimedFaucet) {
        const faucetTx = await stakeManager.claimFaucetTokens();
        await faucetTx.wait();
        console.log("✅ Claimed faucet");
      }
      
      // Stake to become reviewer
      const stakeTx = await stakeManager.stakeToBeReviewer();
      await stakeTx.wait();
      console.log("✅ Became reviewer");
    } else {
      console.log("✅ Already a reviewer");
    }
    
    // 2. Submit a paper
    console.log("\n2. Submitting paper...");
    const publicationFee = await paperRegistry.publicationFee();
    const submitTx = await paperRegistry.submitPaper(
      "testcid",
      ["test"],
      "Computer Science",
      false,
      0,
      { value: publicationFee }
    );
    const receipt = await submitTx.wait();
    console.log("✅ Paper submitted");
    
    // Find paper ID from logs
    let paperId = 0;
    for (const log of receipt.logs) {
      try {
        const parsed = paperRegistry.interface.parseLog({
          topics: log.topics,
          data: log.data
        });
        if (parsed.name === "PaperSubmitted") {
          paperId = Number(parsed.args.paperId);
          break;
        }
      } catch (e) {
        // Skip unparseable logs
      }
    }
    console.log("Paper ID:", paperId);
    
    // 3. Check if reviewer is assigned
    console.log("\n3. Checking assignment...");
    const isAssigned = await reviewPool.isAssignedReviewer(paperId, deployer.address);
    console.log("Is assigned:", isAssigned);
    
    if (!isAssigned) {
      console.log("❌ Not assigned, cannot submit review");
      return;
    }
    
    // 4. Try to submit review (this should fail)
    console.log("\n4. Attempting to submit review...");
    
    try {
      const reviewTx = await reviewPool.submitReview(paperId, 2, "test comment", {
        gasLimit: 500000 // Give plenty of gas
      });
      await reviewTx.wait();
      console.log("✅ Review submitted successfully!");
    } catch (error: any) {
      console.log("❌ Review submission failed:", error.message);
      
      if (error.data) {
        console.log("Error data:", error.data);
      }
      
      // Try to decode the error
      try {
        if (error.data && error.data.startsWith('0x118cdaa7')) {
          console.log("This is OwnableUnauthorizedAccount error");
          console.log("The contract address causing the error:", '0x' + error.data.slice(10, 74));
        }
      } catch (e) {
        console.log("Could not decode error");
      }
    }
    
  } catch (error) {
    console.error("Test failed:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });