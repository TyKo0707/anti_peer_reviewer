import { ethers } from "hardhat";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Testing with account:", signer.address);
  
  // Get deployed contracts
  const paperRegistry = await ethers.getContractAt(
    "PaperRegistry", 
    "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"
  );
  
  try {
    // Test publicationFee call
    console.log("Testing publicationFee()...");
    const fee = await paperRegistry.publicationFee();
    console.log("Publication fee:", ethers.formatEther(fee), "ETH");
    
    // Test submitPaper call
    console.log("\nTesting submitPaper()...");
    const tx = await paperRegistry.submitPaper(
      "QmTestCID123", // cid
      ["blockchain", "peer-review"], // keywords
      "Computer Science", // fieldClassification
      false, // isEmbargoed
      0, // embargoEndTime
      { value: fee } // payment
    );
    
    console.log("Transaction hash:", tx.hash);
    const receipt = await tx.wait();
    console.log("Transaction confirmed in block:", receipt.blockNumber);
    
  } catch (error) {
    console.error("Error testing contracts:", error);
  }
}

main().catch(console.error);