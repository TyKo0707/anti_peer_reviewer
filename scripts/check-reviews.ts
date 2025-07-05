import { ethers } from "hardhat";

async function main() {
  const REVIEW_POOL_ADDRESS = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
  const PAPER_REGISTRY_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
  
  const reviewPool = await ethers.getContractAt("ReviewPool", REVIEW_POOL_ADDRESS);
  const paperRegistry = await ethers.getContractAt("PaperRegistry", PAPER_REGISTRY_ADDRESS);
  
  console.log("=== Checking Existing Reviews ===");
  
  // Check how many papers exist
  try {
    for (let paperId = 0; paperId < 5; paperId++) {
      try {
        const paper = await paperRegistry.getPaper(paperId);
        console.log(`\nPaper ${paperId}:`);
        console.log(`  CID: ${paper.cid}`);
        console.log(`  Author: ${paper.author}`);
        console.log(`  Published: ${paper.isPublished}`);
        
        // Check if reviewers are assigned
        try {
          const assignedReviewers = await reviewPool.getAssignedReviewers(paperId);
          console.log(`  Assigned reviewers: ${assignedReviewers.length}`);
          
          // Check reviews for each assigned reviewer
          for (const reviewer of assignedReviewers) {
            try {
              const review = await reviewPool.getReview(paperId, reviewer);
              const hasReview = review.reviewer !== "0x0000000000000000000000000000000000000000";
              console.log(`    ${reviewer}: ${hasReview ? "Review submitted" : "No review"}`);
              
              if (hasReview) {
                console.log(`      Score: ${review.score}`);
                console.log(`      Revealed: ${review.isRevealed}`);
                console.log(`      Submit time: ${new Date(Number(review.submitTime) * 1000).toISOString()}`);
              }
            } catch (e) {
              console.log(`    ${reviewer}: Error checking review`);
            }
          }
        } catch (e) {
          console.log(`  Error checking reviewers: ${e.message}`);
        }
        
      } catch (e) {
        if (e.message.includes("Paper does not exist")) {
          console.log(`Paper ${paperId}: Does not exist`);
          break;
        } else {
          console.log(`Paper ${paperId}: Error - ${e.message}`);
        }
      }
    }
  } catch (e) {
    console.error("Error:", e);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });