import { ethers } from "hardhat";

async function main() {
  const REVIEW_POOL_ADDRESS = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
  const reviewPool = await ethers.getContractAt("ReviewPool", REVIEW_POOL_ADDRESS);
  
  const paperId = 1;
  const reviewer = "0x1CBd3b2770909D4e10f157cABC84C7264073C9Ec";
  
  console.log("=== Hash Mismatch Debug ===");
  
  // Get the stored review
  const review = await reviewPool.getReview(paperId, reviewer);
  console.log("Stored review:");
  console.log("  Reviewer:", review.reviewer);
  console.log("  Score:", review.score.toString());
  console.log("  Comment Hash (stored):", review.commentHash);
  console.log("  Is Revealed:", review.isRevealed);
  
  // Try different combinations
  const possibleParams = [
    { score: 2, comment: "gjgjgjg" },
    { score: 1, comment: "gjgjgjg" },
    { score: 0, comment: "gjgjgjg" },
    { score: 2, comment: "Very Nice!!!" },
    { score: 2, comment: "cool" },
    { score: 2, comment: "nice" }
  ];
  
  console.log("\nTrying different score/comment combinations:");
  
  for (const params of possibleParams) {
    // Method 1: Frontend method (solidityPacked)
    const frontendHash = ethers.keccak256(
      ethers.solidityPacked(['int8', 'string'], [params.score, params.comment])
    );
    
    // Method 2: Manual encoding
    const manualHash = ethers.keccak256(
      ethers.concat([
        ethers.toBeHex(params.score, 1), // int8 as 1 byte
        ethers.toUtf8Bytes(params.comment)
      ])
    );
    
    const matches = frontendHash === review.commentHash;
    
    console.log(`  Score ${params.score}, Comment "${params.comment}"`);
    console.log(`    Frontend hash: ${frontendHash}`);
    console.log(`    Manual hash:   ${manualHash}`);
    console.log(`    Matches:       ${matches ? "✅" : "❌"}`);
    
    if (matches) {
      console.log("    🎉 FOUND MATCHING PARAMETERS!");
      break;
    }
  }
  
  // Also check what the actual stored hash is expecting
  console.log("\n=== Contract Hash Verification ===");
  console.log("Expected hash (from contract):", review.commentHash);
  
  // Test with the parameters from the error
  const testScore = 2;
  const testComment = "gjgjgjg";
  const testHash = ethers.keccak256(
    ethers.solidityPacked(['int8', 'string'], [testScore, testComment])
  );
  
  console.log(`Test hash (score ${testScore}, comment "${testComment}"):`, testHash);
  console.log("Hash matches:", testHash === review.commentHash);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });