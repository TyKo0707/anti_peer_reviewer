import hre from "hardhat";
import { Provider, Wallet } from "zksync-ethers";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  const {
    PRIVATE_KEY,
    VRF_COORDINATOR_ADDRESS,
    VRF_KEY_HASH,
    VRF_SUBSCRIPTION_ID,
  } = process.env;

  if (!PRIVATE_KEY || !VRF_COORDINATOR_ADDRESS || !VRF_KEY_HASH || !VRF_SUBSCRIPTION_ID) {
    throw new Error("Missing env vars");
  }

  const provider: Provider =
    hre.zkSyncProvider ?? new Provider("https://sepolia.era.zksync.dev");
  const wallet   = new Wallet(PRIVATE_KEY, provider);
  const deployer = new Deployer(hre, wallet);

  /* 1 ── StakeManager */
  const stakeArt   = await deployer.loadArtifact("StakeManager");
  const stakeCtr   = await deployer.deploy(stakeArt, []);
  console.log("StakeManager:", stakeCtr.address);

  /* 2 ── PaperRegistry */
  const regArt     = await deployer.loadArtifact("PaperRegistry");
  const regCtr     = await deployer.deploy(regArt, []);
  console.log("PaperRegistry:", regCtr.address);

  /* 3 ── ReviewPool (needs VRF + two addresses) */
  const poolArt    = await deployer.loadArtifact("ReviewPool");
  const poolCtr    = await deployer.deploy(poolArt, [
    VRF_COORDINATOR_ADDRESS,
    VRF_KEY_HASH,
    BigInt(VRF_SUBSCRIPTION_ID),          // uint64 in constructor
    stakeCtr.address,
    regCtr.address,
  ]);
  console.log("ReviewPool :", poolCtr.address);

  console.log("\nConstructor params passed OK");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Deployment failed:", err);
    process.exit(1);
  });

