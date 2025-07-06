import { ethers } from "hardhat";

async function main() {
  console.log("Function selectors:");
  console.log("claimFaucetTokens():", ethers.id('claimFaucetTokens()').slice(0, 10));
  console.log("hasClaimedFaucet(address):", ethers.id('hasClaimedFaucet(address)').slice(0, 10));
  console.log("stakeToBeReviewer():", ethers.id('stakeToBeReviewer()').slice(0, 10));
  console.log("unstakeReviewer():", ethers.id('unstakeReviewer()').slice(0, 10));
  console.log("balanceOf(address):", ethers.id('balanceOf(address)').slice(0, 10));
  
  console.log("\nLooking for selector: 0x050bb4e3");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });