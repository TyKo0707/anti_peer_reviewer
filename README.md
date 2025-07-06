# Decentralized Blockchain-Based Peer Review System

---

## On-Chain Roles & Workflow

### Roles

* **Researchers:** Submit `PaperTx` with content hash, metadata, and publication stake.
* **Reviewers:** Stake tokens, randomly selected weighted by stake & reputation to review and earn rewards.
* **Arbitrators:** Resolve disputes and plagiarism claims.

### Workflow

1. **Submission:** Author signs PaperTx with content CID, keywords, and metadata.
2. **Initial Filtering:** AI checks structure, grammar, formatting, citations, and gives instant feedback if rejected.
3. **Sampling:** Chainlink-style VRF randomly selects reviewers proportional to stake × reputation to prevent manipulation.
4. **Review:** Reviewers submit scores and detailed comments.
5. **Decision:** Accepted papers mint ERC-721 DOI tokens; others may be resubmitted. Rewards and reputations update.
6. **Dispute Window:** Validators open disputes; jurors decide, slashing dishonest reviewers and rewarding initiators if upheld.

---

## Key Features

* **Fuzzing:** HardHat 3 runs thousands of random tests in Solidity to find bugs in staking, reward claims, and file handling, with minimal repro cases for easy fixes.

* **Rust EVM Core:** New Rust-based engine runs tests \~1.8× faster, enabling deeper, multi-chain security testing without slowing development.

* **Build Profiles:** Named profiles (`dev`, `ci`, `prod`) allow quick switching between debugging, optimized CI testing, and production-ready builds with reproducible results.

---

## Token Economics & Data Management

* Reviewers lock GO token stake to prevent Sybil attacks.
* Authors pay fees funding rewards and storage.
* Valid reviews earn rewards; misconduct burns reviewer stakes.
* Large files stored off-chain; L2 chain holds hashes and metadata to keep gas costs low with full verifiability.

---

## Summary (100 words)

Our application transforms the tedious and biased peer-review system into a transparent blockchain process. Authors upload papers with a fee; AI checks quality and sends instant feedback. A lottery selects bonded reviewers who provide scores and comments, earning rewards for honesty. Accepted papers are permanently recorded and digitally stamped on-chain. Challenges are allowed, with penalties automatically applied to dishonest reviewers.
