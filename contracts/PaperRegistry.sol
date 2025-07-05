// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract PaperRegistry is ERC721, Ownable {
    struct Paper {
        string cid;
        address author;
        uint256 submissionTime;
        uint256 publicationFee;
        bool isPublished;
        uint256 totalScore;
        uint256 reviewCount;
        bool isEmbargoed;
        uint256 embargoEndTime;
        string[] keywords;
        string fieldClassification;
    }

    uint256 public nextPaperId;
    uint256 public publicationFee = 0.01 ether;
    
    mapping(uint256 => Paper) public papers;
    mapping(address => uint256[]) public authorPapers;
    mapping(string => bool) public cidExists;
    
    event PaperSubmitted(uint256 indexed paperId, address indexed author, string cid);
    event PaperPublished(uint256 indexed paperId, address indexed author);
    event PaperRejected(uint256 indexed paperId, address indexed author);
    
    constructor() ERC721("Peer-Review DOI", "DOI") Ownable() {}
    
    function submitPaper(
        string calldata cid,
        string[] calldata keywords,
        string calldata fieldClassification,
        bool isEmbargoed,
        uint256 embargoEndTime
    ) external payable returns (uint256) {
        require(msg.value == publicationFee, "Incorrect publication fee");
        require(!cidExists[cid], "Paper already exists");
        require(bytes(cid).length > 0, "CID cannot be empty");
        
        uint256 paperId = nextPaperId++;
        
        Paper storage paper = papers[paperId];
        paper.cid = cid;
        paper.author = msg.sender;
        paper.submissionTime = block.timestamp;
        paper.publicationFee = msg.value;
        paper.fieldClassification = fieldClassification;
        paper.isEmbargoed = isEmbargoed;
        paper.embargoEndTime = embargoEndTime;
        
        // Copy keywords array manually to avoid calldata to storage issue
        for (uint256 i = 0; i < keywords.length; i++) {
            paper.keywords.push(keywords[i]);
        }
        
        authorPapers[msg.sender].push(paperId);
        cidExists[cid] = true;
        
        emit PaperSubmitted(paperId, msg.sender, cid);
        return paperId;
    }
    
    function publishPaper(uint256 paperId) external onlyOwner {
        require(paperId < nextPaperId, "Paper does not exist");
        require(!papers[paperId].isPublished, "Paper already published");
        
        Paper storage paper = papers[paperId];
        paper.isPublished = true;
        
        _safeMint(paper.author, paperId);
        
        emit PaperPublished(paperId, paper.author);
    }
    
    function rejectPaper(uint256 paperId) external onlyOwner {
        require(paperId < nextPaperId, "Paper does not exist");
        require(!papers[paperId].isPublished, "Paper already published");
        
        Paper storage paper = papers[paperId];
        
        // Partial refund (50% of publication fee)
        uint256 refundAmount = paper.publicationFee / 2;
        payable(paper.author).transfer(refundAmount);
        
        emit PaperRejected(paperId, paper.author);
    }
    
    function updatePaperScore(uint256 paperId, int8 scoreChange) external onlyOwner {
        require(paperId < nextPaperId, "Paper does not exist");
        
        Paper storage paper = papers[paperId];
        paper.totalScore = uint256(int256(paper.totalScore) + scoreChange);
        paper.reviewCount++;
    }
    
    function getPaper(uint256 paperId) external view returns (Paper memory) {
        require(paperId < nextPaperId, "Paper does not exist");
        return papers[paperId];
    }
    
    function getAuthorPapers(address author) external view returns (uint256[] memory) {
        return authorPapers[author];
    }
    
    function setPublicationFee(uint256 _fee) external onlyOwner {
        publicationFee = _fee;
    }
    
    function withdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
}