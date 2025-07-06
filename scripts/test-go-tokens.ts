import { ethers } from "hardhat";

async function main() {
  const [deployer, user1] = await ethers.getSigners();
  
  console.log("Testing GO tokens functionality...");
  console.log("Deployer:", deployer.address);
  console.log("User1:", user1.address);
  
  // Get deployed StakeManager contract
  const stakeManager = await ethers.getContractAt(
    "StakeManager", 
    "0x5FbDB2315678afecb367f032d93F642f64180aa3" // Update with actual address
  );
  
  try {
    // Check token name and symbol
    const name = await stakeManager.name();
    const symbol = await stakeManager.symbol();
    console.log(`\nToken: ${name} (${symbol})`);
    
    // Check deployer balance (should have initial supply)
    const deployerBalance = await stakeManager.balanceOf(deployer.address);
    console.log(`Deployer balance: ${ethers.formatEther(deployerBalance)} ${symbol}`);
    
    // Check user1 balance (should be 0)
    let user1Balance = await stakeManager.balanceOf(user1.address);
    console.log(`User1 balance: ${ethers.formatEther(user1Balance)} ${symbol}`);
    
    // Test faucet claim for user1
    console.log("\nTesting faucet claim...");
    const hasClaimedBefore = await stakeManager.hasClaimedFaucet(user1.address);
    console.log(`User1 has claimed faucet: ${hasClaimedBefore}`);
    
    if (!hasClaimedBefore) {
      const tx = await stakeManager.connect(user1).claimFaucetTokens();
      await tx.wait();
      console.log("Faucet claim successful!");
      
      // Check balance after claim
      user1Balance = await stakeManager.balanceOf(user1.address);
      console.log(`User1 balance after faucet: ${ethers.formatEther(user1Balance)} ${symbol}`);
      
      // Check if can claim again (should fail)
      try {
        await stakeManager.connect(user1).claimFaucetTokens();
        console.log("ERROR: Should not be able to claim twice!");
      } catch (error) {
        console.log("✓ Correctly prevented double claiming");
      }
    }
    
    // Test staking
    console.log("\nTesting reviewer staking...");
    const minStake = await stakeManager.MIN_STAKE();
    console.log(`Min stake required: ${ethers.formatEther(minStake)} ${symbol}`);
    
    if (user1Balance >= minStake) {
      const tx = await stakeManager.connect(user1).stakeToBeReviewer();
      await tx.wait();
      console.log("Staking successful!");
      
      // Check reviewer status
      const reviewer = await stakeManager.getReviewer(user1.address);
      console.log(`Reviewer staked: ${ethers.formatEther(reviewer.stake)} ${symbol}`);
      console.log(`Reviewer reputation: ${reviewer.reputation}`);
      console.log(`Reviewer active: ${reviewer.isActive}`);
    } else {
      console.log(`Insufficient balance to stake. Need ${ethers.formatEther(minStake)} ${symbol}`);
    }
    
  } catch (error) {
    console.error("Error testing GO tokens:", error);
  }
}

main().catch(console.error);