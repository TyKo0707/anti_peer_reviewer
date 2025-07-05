import { ethers } from "hardhat";

async function main() {
  const [deployer, author, reviewer1, reviewer2, reviewer3] = await ethers.getSigners();
  
  // Contract addresses (update these with your deployed addresses)
  const STAKE_MANAGER_ADDRESS = "0x610178dA211FEF7D417bC0e6FeD39F05609AD788";
  const PAPER_REGISTRY_ADDRESS = "0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e";
  const REVIEW_POOL_ADDRESS = "0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0";
  
  // Get contract instances
  const stakeManager = await ethers.getContractAt("StakeManager", STAKE_MANAGER_ADDRESS);
  const paperRegistry = await ethers.getContractAt("PaperRegistry", PAPER_REGISTRY_ADDRESS);
  const reviewPool = await ethers.getContractAt("ReviewPool", REVIEW_POOL_ADDRESS);
  
  console.log("=== Testing Peer Review Workflow ===\n");
  
  // 1. Check if ReviewPool is set in PaperRegistry
  console.log("1. Checking ReviewPool address in PaperRegistry...");
  try {
    const reviewPoolAddr = await paperRegistry.reviewPool();
    console.log("ReviewPool address:", reviewPoolAddr);
    console.log("Expected:", REVIEW_POOL_ADDRESS);
    console.log("Match:", reviewPoolAddr.toLowerCase() === REVIEW_POOL_ADDRESS.toLowerCase());
  } catch (e) {
    console.log("Error: ReviewPool not set in PaperRegistry");
  }
  
  // 2. Fund accounts with GO tokens
  console.log("\n2. Funding accounts with GO tokens...");
  for (const account of [author, reviewer1, reviewer2, reviewer3]) {
    try {
      const hasClaimedBefore = await stakeManager.connect(account).hasClaimedFaucet(account.address);
      if (!hasClaimedBefore) {
        const tx = await stakeManager.connect(account).claimFaucetTokens();
        await tx.wait();
        console.log(`✓ Funded ${account.address} with GO tokens`);
      } else {
        console.log(`- ${account.address} already claimed faucet`);
      }
      
      const balance = await stakeManager.balanceOf(account.address);
      console.log(`  Balance: ${ethers.formatEther(balance)} GO`);
    } catch (e) {
      console.log(`✗ Failed to fund ${account.address}:`, e.message);
    }
  }
  
  // 3. Stake reviewers
  console.log("\n3. Staking reviewers...");
  for (const reviewer of [reviewer1, reviewer2, reviewer3]) {
    try {
      const reviewerData = await stakeManager.getReviewer(reviewer.address);
      if (!reviewerData.isActive) {
        const tx = await stakeManager.connect(reviewer).stakeToBeReviewer();
        await tx.wait();
        console.log(`✓ ${reviewer.address} staked as reviewer`);
      } else {
        console.log(`- ${reviewer.address} already staked`);
      }
    } catch (e) {
      console.log(`✗ Failed to stake ${reviewer.address}:`, e.message);
    }
  }
  
  // 4. Check eligible reviewers
  console.log("\n4. Checking eligible reviewers...");
  try {
    const eligibleReviewers = await stakeManager.getEligibleReviewers();
    console.log(`Found ${eligibleReviewers.length} eligible reviewers:`);
    eligibleReviewers.forEach((addr, i) => {
      console.log(`  ${i + 1}. ${addr}`);
    });
    
    if (eligibleReviewers.length < 3) {
      console.log("⚠️  Warning: Need at least 3 eligible reviewers for assignment");
      return;
    }
  } catch (e) {
    console.log("✗ Failed to get eligible reviewers:", e.message);
    return;
  }
  
  // 5. Submit a paper
  console.log("\n5. Submitting a paper...");
  try {
    const publicationFee = await paperRegistry.publicationFee();
    console.log(`Publication fee: ${ethers.formatEther(publicationFee)} ETH`);
    
    const cid = "QmTestPaper123";
    const keywords = ["blockchain", "peer-review"];
    const fieldClassification = "Computer Science";
    
    const tx = await paperRegistry.connect(author).submitPaper(
      cid,
      keywords,
      fieldClassification,
      false, // not embargoed
      0, // embargo end time
      { value: publicationFee }
    );
    
    const receipt = await tx.wait();
    console.log("✓ Paper submitted successfully");
    console.log("Transaction hash:", receipt.hash);
    
    // Find the PaperSubmitted event
    const paperSubmittedEvent = receipt.logs.find(
      log => log.topics[0] === ethers.id("PaperSubmitted(uint256,address,string)")
    );
    
    if (paperSubmittedEvent) {
      const decoded = paperRegistry.interface.parseLog({
        topics: paperSubmittedEvent.topics,
        data: paperSubmittedEvent.data
      });
      const paperId = decoded.args.paperId;
      console.log("Paper ID:", paperId.toString());
      
      // 6. Check if reviewers were assigned
      console.log("\n6. Checking reviewer assignments...");
      try {
        const assignedReviewers = await reviewPool.getAssignedReviewers(paperId);
        console.log(`Found ${assignedReviewers.length} assigned reviewers:`);
        assignedReviewers.forEach((addr, i) => {
          console.log(`  ${i + 1}. ${addr}`);
        });
        
        if (assignedReviewers.length === 0) {
          console.log("⚠️  No reviewers assigned automatically. Trying manual assignment...");
          try {
            const manualTx = await reviewPool.assignReviewers(paperId);
            await manualTx.wait();
            console.log("✓ Manual assignment successful");
            
            const newAssignedReviewers = await reviewPool.getAssignedReviewers(paperId);
            console.log(`Now assigned ${newAssignedReviewers.length} reviewers:`);
            newAssignedReviewers.forEach((addr, i) => {
              console.log(`  ${i + 1}. ${addr}`);
            });
          } catch (e) {
            console.log("✗ Manual assignment failed:", e.message);
          }
        }
        
      } catch (e) {
        console.log("✗ Failed to check assignments:", e.message);
      }
      
    } else {
      console.log("⚠️  Could not find PaperSubmitted event");
    }
    
  } catch (e) {
    console.log("✗ Failed to submit paper:", e.message);
  }
  
  console.log("\n=== Test Complete ===");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });