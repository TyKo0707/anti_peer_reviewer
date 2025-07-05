import { ethers } from "hardhat";

async function main() {
  const [deployer, author, reviewer] = await ethers.getSigners();
  
  const REVIEW_POOL_ADDRESS = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
  const PAPER_REGISTRY_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
  const reviewPool = await ethers.getContractAt("ReviewPool", REVIEW_POOL_ADDRESS);
  const paperRegistry = await ethers.getContractAt("PaperRegistry", PAPER_REGISTRY_ADDRESS);
  
  console.log("=== Testing Manual Reveal ===");
  
  // Use the actual reviewer account from the latest error
  const reviewerAccount = await ethers.getImpersonatedSigner("0x1CBd3b2770909D4e10f157cABC84C7264073C9Ec");
  
  const paperId = 1;
  const score = 2;
  const comment = "gjgjgjg";
  
  console.log("Attempting to reveal review...");
  console.log("Paper ID:", paperId);
  console.log("Score:", score);
  console.log("Comment:", comment);
  console.log("Reviewer:", reviewerAccount.address);
  
  try {
    // Try to reveal the review
    const tx = await reviewPool.connect(reviewerAccount).revealReview(paperId, score, comment);
    await tx.wait();
    console.log("✓ Reveal successful!");
  } catch (error: any) {
    console.error("✗ Reveal failed:", error.message);
    
    // Try to decode the error
    if (error.data) {
      console.log("Error data:", error.data);
    }
    
    // Check authorization setup
    console.log("\n=== Checking Authorization Setup ===");
    
    try {
      const paperRegistryOwner = await paperRegistry.owner();
      const reviewPoolInPaperRegistry = await paperRegistry.reviewPool();
      
      console.log("PaperRegistry owner:", paperRegistryOwner);
      console.log("ReviewPool address in PaperRegistry:", reviewPoolInPaperRegistry);
      console.log("Expected ReviewPool address:", REVIEW_POOL_ADDRESS);
      console.log("ReviewPool properly set:", reviewPoolInPaperRegistry.toLowerCase() === REVIEW_POOL_ADDRESS.toLowerCase());
      
      // Try calling updatePaperScore directly from ReviewPool
      console.log("\nTesting direct updatePaperScore call...");
      try {
        await paperRegistry.connect(reviewPool.address).updatePaperScore(paperId, 2);
        console.log("✓ Direct call would work");
      } catch (e) {
        console.log("✗ Direct call would fail:", e.message);
      }
      
    } catch (e) {
      console.log("Error checking authorization:", e.message);
    }
    
    // Check the assignment manually
    try {
      const assignment = await reviewPool.assignments(paperId);
      console.log("\nAssignment data:", {
        paperId: assignment[0].toString(),
        assignedReviewers: assignment[1],
        deadline: assignment[2].toString(),
        reviewCount: assignment[3].toString(),
        isCompleted: assignment[4]
      });
    } catch (e) {
      console.log("Error getting assignment:", e.message);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });