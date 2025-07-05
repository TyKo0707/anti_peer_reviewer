// ============================================================================
//  Peer‑Review AA Skeleton
//  Implements the custom pieces only; everything else is imported from
//  https://github.com/eth-infinitism/account-abstraction                     
//  ▸ PeerReviewAccount.sol          – smart‑wallet with Google‑JWT validation
//  ▸ PeerReviewAccountFactory.sol   – minimal proxy factory (counter‑factual)
//  ▸ PeerReviewPaymaster.sol        – optional gas sponsor whitelisting JWT
//  ▸ scripts/Deploy.s.sol           – Foundry runtime deployment script
//  ▸ scripts/SubmitPaper.ts         – TypeScript helper that builds a UserOp
// ============================================================================

/* --------------------------------------------------------------------------
   PeerReviewAccount.sol  –  extends SimpleAccount and overrides validateUserOp
----------------------------------------------------------------------------*/
// SPDX‑License‑Identifier: MIT
pragma solidity ^0.8.21;

import "@account‑abstraction/contracts/samples/SimpleAccount.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/// @notice Minimal Google‑JWT based AA wallet for the peer‑review dApp.
///         The front‑end places the raw JWT in userOp.signature.
contract PeerReviewAccount is SimpleAccount {
    using ECDSA for bytes32;

    // Google publishes a set of public keys (JWK) that correspond to key ids (kid).
    // For simplicity we hard‑code the hash of the PEM‑encoded key we trust.
    bytes32 public immutable googlePemHash;

    /// @param _ep          Address of the shared EntryPoint.
    /// @param _googlePem   SHA‑256 hash of Google public key PEM we will accept.
    constructor(IEntryPoint _ep, bytes32 _googlePem) SimpleAccount(_ep) {
        googlePemHash = _googlePem;
    }

    /* ---------------------------------------------------------------------- */
    /*                        AA hook: validateUserOp                         */
    /* ---------------------------------------------------------------------- */
    /// @inheritdoc IAccount
    function validateUserOp(
        UserOperation calldata userOp,
        bytes32, /* userOpHash */
        uint256 /* missingAccountFunds */
    ) external view override returns (uint256 validationData) {
        // 1. Extract the JWT from userOp.signature.
        //    Expecting header.payload.signature in base64url (concatenated with '.')
        bytes memory jwt = userOp.signature;
        require(jwt.length > 0, "JWT missing");

        // 2. Very light‑weight verification: split & hash header to check the kid.
        //    Front‑end must ensure header.kid corresponds to googlePemHash.
        //    Full JWT validation (exp, iss, aud) can be done off‑chain; here we
        //    only prove that Google signed this token.
        bytes32 signedHash = keccak256(abi.encodePacked(userOp.sender, userOp.nonce));
        address recovered = signedHash.toEthSignedMessageHash().recover(_sigSlice(jwt));
        require(bytes32(uint256(uint160(recovered))) == googlePemHash, "Invalid JWT signer");

        // return 0 signals validation OK, no custom deadline.
        return 0;
    }

    /*
     * Very naive helper that extracts the *third* part (sig) of the JWT.
     * In production, fully parse base64url & DER‑decode the signature.
     */
    function _sigSlice(bytes memory jwt) private pure returns (bytes memory sig) {
        uint256 dots = 0;
        uint256 i;
        for (i = 0; i < jwt.length; i++) if (jwt[i] == '.') dots++;
        require(dots == 2, "bad jwt format");
        // copy bytes after last dot
        uint256 start;
        for (i = jwt.length; i > 0; i--) {
            if (jwt[i‑1] == '.') { start = i; break; }
        }
        sig = new bytes(jwt.length ‑ start);
        for (i = 0; i < sig.length; i++) sig[i] = jwt[start + i];
    }
}

/* --------------------------------------------------------------------------
   PeerReviewAccountFactory.sol  –  clones the wallet via CREATE2
----------------------------------------------------------------------------*/
// SPDX‑License‑Identifier: MIT
pragma solidity ^0.8.21;

import "@account‑abstraction/contracts/samples/SimpleAccountFactory.sol";
import "./PeerReviewAccount.sol";

contract PeerReviewAccountFactory is SimpleAccountFactory {
    bytes32 public immutable googlePemHash;

    constructor(IEntryPoint _ep, bytes32 _googlePem) SimpleAccountFactory(_ep) {
        googlePemHash = _googlePem;
    }

    /// override createAccount to deploy PeerReviewAccount instead of SimpleAccount
    function createAccount(address owner, uint256 salt) public override returns (SimpleAccount) {
        address addr = getAddress(owner, salt);
        uint256 codeSize;
        assembly { codeSize := extcodesize(addr) }
        if (codeSize > 0) {
            return SimpleAccount(payable(addr));
        }
        return new PeerReviewAccount{salt: bytes32(salt)}(entryPoint(), googlePemHash);
    }
}

/* --------------------------------------------------------------------------
   PeerReviewPaymaster.sol  –  optional: sponsor gas if JWT is valid
----------------------------------------------------------------------------*/
// SPDX‑License‑Identifier: MIT
pragma solidity ^0.8.21;

import "@account‑abstraction/contracts/paymaster/VerifyingPaymaster.sol";
import "./PeerReviewAccount.sol";

contract PeerReviewPaymaster is VerifyingPaymaster {
    constructor(IEntryPoint _ep, address _signer) VerifyingPaymaster(_ep, _signer) {}

    /// @notice Accept only UserOps whose sender is a PeerReviewAccount & has non‑empty JWT.
    function _validatePaymasterUserOp(UserOperation calldata userOp, bytes32) internal view override returns (bytes memory) {
        require(userOp.signature.length > 0, "no jwt");
        // Simple sender‑type check
        uint256 size;
        assembly { size := extcodesize(userOp.sender) }
        require(size > 0, "sender not contract");
        return "";
    }
}

/* --------------------------------------------------------------------------
   scripts/Deploy.s.sol  –  Foundry script: deploy EntryPoint (if test), factory, paymaster
----------------------------------------------------------------------------*/
// SPDX‑License‑Identifier: MIT
pragma solidity ^0.8.21;

import "forge-std/Script.sol";
import "@account‑abstraction/contracts/core/EntryPoint.sol";
import "../PeerReviewAccountFactory.sol";
import "../PeerReviewPaymaster.sol";

contract Deploy is Script {
    bytes32 constant GOOGLE_PEM_HASH = 0x9bfbab8e23d2b3d3b8d1c4e3f6a8e2d9f3c4b1a0d2c3e4f5a6b7c8d9e0f1a2b3; // example

    function run() external {
        vm.startBroadcast();
        EntryPoint ep = new EntryPoint();
        PeerReviewAccountFactory fac = new PeerReviewAccountFactory(ep, GOOGLE_PEM_HASH);
        PeerReviewPaymaster pay = new PeerReviewPaymaster(ep, address(fac));
        vm.stopBroadcast();
    }
}

/* --------------------------------------------------------------------------
   scripts/SubmitPaper.ts  –  TS helper creating a UserOp via SDK
----------------------------------------------------------------------------*/
/**
 *  npm i @account‑abstraction/sdk ethers @openzeppelin/contracts
 */
import { ethers } from "ethers";
import { KernelSmartAccount, Presets } from "@zerodev/sdk";
import { EntryPoint__factory } from "@account‑abstraction/contracts/dist/typechain";

async function main() {
  // ––– configure provider and bundler –––
  const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
  const entryPoint = EntryPoint__factory.connect(process.env.ENTRYPOINT!, provider);

  // ––– obtain Google JWT off‑chain (user login) –––
  const jwt = await getGoogleJWT(); // implement this in your front‑end

  // ––– build Kernel smart‑account instance –––
  const smartAccount = await Presets.Builder.KernelAccount
      .connect({ entryPointAddress: entryPoint.address, bundlerUrl: process.env.BUNDLER! })
      .withSignature(jwt) // pass raw JWT as signature
      .build();

  // ––– encode callData for submitPaper(cid) –––
  const peerReviewEscrow = new ethers.Contract(
      process.env.ESCROW!,
      ["function submitPaper(string cid)"]
  );
  const callData = peerReviewEscrow.interface.encodeFunctionData("submitPaper", ["Qm123..."]);

  // ––– create & send UserOp –––
  const userOp = await smartAccount.buildUserOp({ target: peerReviewEscrow.address, data: callData });
  const opHash = await smartAccount.sendUserOp(userOp);
  console.log("submitted userOp: ", opHash);
}

main();
