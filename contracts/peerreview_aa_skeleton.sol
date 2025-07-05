// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

/* -------------------------------------------------------------------------
   Peer‑Review AA Skeleton  – SOLIDITY‑ONLY VERSION
   Implements the custom pieces for Google‑JWT based authentication.
   External AA primitives are imported from
   https://github.com/eth-infinitism/account-abstraction

   ├─ src/PeerReviewAccount.sol        – smart‑wallet with Google‑JWT validation
   ├─ src/PeerReviewAccountFactory.sol – minimal proxy factory (CREATE2)
   ├─ src/PeerReviewPaymaster.sol      – optional gas sponsor whitelisting JWT
   └─ script/Deploy.s.sol              – Foundry deployment script
--------------------------------------------------------------------------*/

// -------------------------------------------------------------------------
//  PeerReviewAccount.sol
// -------------------------------------------------------------------------

import "@account-abstraction/contracts/samples/SimpleAccount.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @title PeerReviewAccount
/// @notice Minimal smart‑account wallet that accepts a Google‑signed JWT as
///         authentication.  The dApp front‑end must place the raw JWT string
///         in `userOp.signature`.
contract PeerReviewAccount is SimpleAccount {
    using ECDSA for bytes32;

    /// @dev SHA‑256 hash of the trusted Google PEM public key.
    bytes32 public immutable googlePemHash;

    /// @param _ep         Address of the shared ERC‑4337 EntryPoint.
    /// @param _googlePem  SHA‑256 hash of the Google public key PEM to trust.
    constructor(IEntryPoint _ep, bytes32 _googlePem) SimpleAccount(_ep) {
        googlePemHash = _googlePem;
    }

    /* ------------------------------------------------------------------ */
    /*                 Account‑Abstraction validation hook                */
    /* ------------------------------------------------------------------ */

    /// @inheritdoc IAccount
    function validateUserOp(
        UserOperation calldata userOp,
        bytes32 /*userOpHash*/,  
        uint256 /*missingAccountFunds*/
    ) external view override returns (uint256 validationData) {
        // 1. Ensure a JWT is supplied.
        bytes memory jwt = userOp.signature;
        require(jwt.length > 0, "JWT missing");

        // 2. Build a simple challenge (sender + nonce).
        bytes32 challenge = keccak256(abi.encodePacked(userOp.sender, userOp.nonce));

        // 3. Recover signer from the JWT signature (very naive slice).
        address signer = challenge.toEthSignedMessageHash().recover(_extractSig(jwt));

        // 4. Compare signer hash to the trusted Google key hash.
        require(bytes32(uint256(uint160(signer))) == googlePemHash, "Invalid JWT signer");

        // 0 means validation succeeded with no time‑limit.
        return 0;
    }

    /* ------------------------------------------------------------------ */
    /*                       Helper: extract JWT sig                      */
    /* ------------------------------------------------------------------ */

    /// @dev Returns the bytes after the last '.' in the JWT (signature).
    ///      ⚠️  Demo‑only; real code should fully parse base64url & DER.
    function _extractSig(bytes memory jwt) private pure returns (bytes memory sig) {
        uint256 dots;
        uint256 i;
        for (i = 0; i < jwt.length; i++) if (jwt[i] == ".") dots++;
        require(dots == 2, "Bad JWT format");

        uint256 start;
        for (i = jwt.length; i > 0; i--) {
            if (jwt[i - 1] == ".") { start = i; break; }
        }
        sig = new bytes(jwt.length - start);
        for (i = 0; i < sig.length; i++) sig[i] = jwt[start + i];
    }
}

// -------------------------------------------------------------------------
//  PeerReviewAccountFactory.sol
// -------------------------------------------------------------------------

pragma solidity ^0.8.21;

import "@account-abstraction/contracts/samples/SimpleAccountFactory.sol";

/// @notice Factory that deploys PeerReviewAccount wallets via CREATE2 so the
///         address can be known before first use (counter‑factual).
contract PeerReviewAccountFactory is SimpleAccountFactory {
    bytes32 public immutable googlePemHash;

    constructor(IEntryPoint _ep, bytes32 _googlePem) SimpleAccountFactory(_ep) {
        googlePemHash = _googlePem;
    }

    /// @inheritdoc SimpleAccountFactory
    function createAccount(address owner, uint256 salt)
        public
        override
        returns (SimpleAccount)
    {
        address addr = getAddress(owner, salt);
        uint256 size;
        assembly { size := extcodesize(addr) }
        if (size > 0) {
            return SimpleAccount(payable(addr));
        }
        return new PeerReviewAccount{salt: bytes32(salt)}(entryPoint(), googlePemHash);
    }
}

// -------------------------------------------------------------------------
//  PeerReviewPaymaster.sol  – optional gas sponsor
// -------------------------------------------------------------------------

pragma solidity ^0.8.21;

import "@account-abstraction/contracts/paymaster/VerifyingPaymaster.sol";

/// @dev Simple paymaster that only checks the presence of a JWT.  A production
///      version would replay the same Google validation off‑chain and may add
///      rate‑limits or stake requirements.
contract PeerReviewPaymaster is VerifyingPaymaster {
    constructor(IEntryPoint _ep, address _signer)
        VerifyingPaymaster(_ep, _signer)
    {}

    function _validatePaymasterUserOp(UserOperation calldata userOp, bytes32)
        internal
        view
        override
        returns (bytes memory)
    {
        require(userOp.signature.length > 0, "No JWT supplied");
        return ""; // empty context
    }
}

// -------------------------------------------------------------------------
//  script/Deploy.s.sol  – Foundry deployment script
// -------------------------------------------------------------------------

pragma solidity ^0.8.21;

import "forge-std/Script.sol";
import "@account-abstraction/contracts/core/EntryPoint.sol";
import "../src/PeerReviewAccountFactory.sol";
import "../src/PeerReviewPaymaster.sol";

contract Deploy is Script {
    // Example placeholder value – replace with the **actual** SHA‑256 hash of
    // the Google JWK you intend to trust.
    bytes32 constant GOOGLE_PEM_HASH = 0x9bfbab8e23d2b3d3b8d1c4e3f6a8e2d9f3c4b1a0d2c3e4f5a6b7c8d9e0f1a2b3;

    function run() external {
        vm.startBroadcast();

        EntryPoint ep = new EntryPoint();
        PeerReviewAccountFactory factory = new PeerReviewAccountFactory(ep, GOOGLE_PEM_HASH);
        PeerReviewPaymaster paymaster = new PeerReviewPaymaster(ep, address(factory));

        vm.stopBroadcast();
    }
}
