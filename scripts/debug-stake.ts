import { ethers } from "hardhat";

async function main() {
  const STAKE_MANAGER_ADDRESS = "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707";
  
  // Get the account that's having issues
  const accountAddress = "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199";
  const account = await ethers.getImpersonatedSigner(accountAddress);
  
  const stakeManager = await ethers.getContractAt("StakeManager", STAKE_MANAGER_ADDRESS);
  
  console.log("=== Debug Staking Issue ===");
  console.log("Account:", accountAddress);
  console.log("StakeManager:", STAKE_MANAGER_ADDRESS);
  
  try {
    // Check balance
    console.log("\n1. Checking GO token balance...");
    const balance = await stakeManager.balanceOf(accountAddress);
    console.log("Balance:", ethers.formatEther(balance), "GO");
    
    // Check min stake requirement
    const minStake = await stakeManager.MIN_STAKE();
    console.log("Min Stake Required:", ethers.formatEther(minStake), "GO");
    console.log("Has enough tokens:", balance >= minStake);
    
    // Check if already staked
    console.log("\n2. Checking if already staked...");
    const reviewer = await stakeManager.getReviewer(accountAddress);
    console.log("Current stake:", ethers.formatEther(reviewer.stake), "GO");
    console.log("Is active:", reviewer.isActive);
    console.log("Already staked:", reviewer.stake > 0);
    
    // Check faucet status
    console.log("\n3. Checking faucet status...");
    const hasClaimedFaucet = await stakeManager.hasClaimedFaucet(accountAddress);
    console.log("Has claimed faucet:", hasClaimedFaucet);
    
    // Try to call the function and see what happens
    console.log("\n4. Testing stakeToBeReviewer call...");
    
    if (balance < minStake) {
      console.log("❌ Cannot stake: insufficient balance");
      
      if (!hasClaimedFaucet) {
        console.log("💡 Trying to claim faucet first...");
        try {
          const faucetTx = await stakeManager.connect(account).claimFaucetTokens();
          await faucetTx.wait();
          console.log("✅ Faucet claimed successfully");
          
          const newBalance = await stakeManager.balanceOf(accountAddress);
          console.log("New balance:", ethers.formatEther(newBalance), "GO");
        } catch (e) {
          console.log("❌ Faucet failed:", e.message);
        }
      }
    } else if (reviewer.stake > 0) {
      console.log("❌ Cannot stake: already staked");
    } else {
      console.log("✅ Should be able to stake, trying now...");
      try {
        const tx = await stakeManager.connect(account).stakeToBeReviewer();
        await tx.wait();
        console.log("✅ Staking successful!");
      } catch (e) {
        console.log("❌ Staking failed:", e.message);
        if (e.data) {
          console.log("Error data:", e.data);
        }
      }
    }
    
  } catch (error) {
    console.error("Debug error:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });