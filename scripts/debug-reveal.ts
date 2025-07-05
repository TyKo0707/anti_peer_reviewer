import { ethers } from "hardhat";

async function main() {
  const [deployer, author, reviewer] = await ethers.getSigners();
  
  const REVIEW_POOL_ADDRESS = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
  const PAPER_REGISTRY_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
  
  const reviewPool = await ethers.getContractAt("ReviewPool", REVIEW_POOL_ADDRESS);
  const paperRegistry = await ethers.getContractAt("PaperRegistry", PAPER_REGISTRY_ADDRESS);
  
  console.log("=== Debug Reveal Issue ===");
  
  const paperId = 0; // Update this to the paper ID you're trying to reveal
  const reviewerAddress = "0xa0Ee7A142d267C1f36714E4a8F75612F20a79720"; // Update this from your error
  
  try {
    // Check if paper exists
    console.log("\n1. Checking if paper exists...");
    try {
      const paper = await paperRegistry.getPaper(paperId);
      console.log("✓ Paper exists:", {
        cid: paper.cid,
        author: paper.author,
        isPublished: paper.isPublished
      });
    } catch (e) {
      console.log("✗ Paper doesn't exist:", e.message);
      return;
    }
    
    // Check if reviewer is assigned
    console.log("\n2. Checking reviewer assignment...");
    const isAssigned = await reviewPool.isAssignedReviewer(paperId, reviewerAddress);
    console.log("Is reviewer assigned:", isAssigned);
    
    if (!isAssigned) {
      console.log("✗ Reviewer not assigned to this paper");
      return;
    }
    
    // Check if review was submitted
    console.log("\n3. Checking review status...");
    try {
      const review = await reviewPool.getReview(paperId, reviewerAddress);
      console.log("Review details:", {
        reviewer: review.reviewer,
        score: review.score.toString(),
        isRevealed: review.isRevealed,
        submitTime: new Date(Number(review.submitTime) * 1000).toISOString(),
        commentHash: review.commentHash
      });
      
      if (review.reviewer === "0x0000000000000000000000000000000000000000") {
        console.log("✗ No review submitted yet");
        return;
      }
      
      if (review.isRevealed) {
        console.log("✗ Review already revealed");
        return;
      }
    } catch (e) {
      console.log("✗ Error getting review:", e.message);
      return;
    }
    
    // Check timing constraints
    console.log("\n4. Checking timing constraints...");
    try {
      const assignment = await reviewPool.assignments(paperId);
      const currentTime = Math.floor(Date.now() / 1000);
      const deadline = Number(assignment[2]); // deadline is 3rd element in tuple
      const reviewPeriod = 7 * 24 * 60 * 60; // 7 days in seconds
      
      console.log("Timing info:", {
        currentTime: new Date(currentTime * 1000).toISOString(),
        deadline: new Date(deadline * 1000).toISOString(),
        revealDeadline: new Date((deadline + reviewPeriod) * 1000).toISOString(),
        canReveal: currentTime <= deadline + reviewPeriod
      });
    } catch (e) {
      console.log("✗ Error checking timing:", e.message);
    }
    
    // Test hash creation
    console.log("\n5. Testing hash creation...");
    const score = 2;
    const comment = "Very Nice!!!";
    
    // Method 1: Using ethers.solidityPacked (frontend method)
    const frontendHash = ethers.keccak256(
      ethers.solidityPacked(['int8', 'string'], [score, comment])
    );
    
    // Method 2: Using ethers.concat (alternative)
    const alternativeHash = ethers.keccak256(
      ethers.concat([
        ethers.toBeHex(score, 1), // int8 is 1 byte
        ethers.toUtf8Bytes(comment)
      ])
    );
    
    console.log("Hash comparison:", {
      frontendHash,
      alternativeHash,
      match: frontendHash === alternativeHash
    });
    
  } catch (e) {
    console.error("Debug error:", e);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });