// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./MockNDVIOracle.sol";
import "./ForestNFT.sol";

contract MEWEscrow {
    IERC20 public paymentToken;
    MockNDVIOracle public oracle;
    ForestNFT public nftContract;

    struct Escrow {
        address sponsor;
        address worker;
        uint256 totalAmount;
        uint256 targetNDVIScore;
        uint8 currentPhase; // 1: 30% paid (Planted), 2: 60% paid (Growing), 3: 100% paid (Verified)
    }

    // Mapping from tokenId to its Escrow details
    mapping(uint256 => Escrow) public escrows;

    event FundsDeposited(uint256 indexed tokenId, address indexed sponsor, address indexed worker, uint256 amount);
    event FundsReleased(uint256 indexed tokenId, address indexed worker, uint256 amount, uint8 phase);

    constructor(address _paymentToken, address _oracle, address _nftContract) {
        paymentToken = IERC20(_paymentToken);
        oracle = MockNDVIOracle(_oracle);
        nftContract = ForestNFT(_nftContract);
    }

    // Sponsor deposits funds for a specific parcel (NFT)
    function depositFunds(
        uint256 tokenId,
        address worker,
        uint256 amount,
        uint256 targetNDVIScore
    ) external {
        require(amount >= 4, "Amount must be at least 4 for splits");
        require(escrows[tokenId].totalAmount == 0, "Escrow already exists for this token");

        // Transfer all tokens from sponsor to this escrow contract
        require(paymentToken.transferFrom(msg.sender, address(this), amount), "Transfer failed");

        uint256 upfront = (amount * 30) / 100;
        
        escrows[tokenId] = Escrow({
            sponsor: msg.sender,
            worker: worker,
            totalAmount: amount,
            targetNDVIScore: targetNDVIScore,
            currentPhase: 1
        });

        // Transfer upfront Phase 1 payment (30%) to the worker immediately
        require(paymentToken.transfer(worker, upfront), "Upfront transfer failed");

        emit FundsDeposited(tokenId, msg.sender, worker, amount);
        emit FundsReleased(tokenId, worker, upfront, 1);
    }

    // Can be called by anyone (e.g. an automation script) to check Oracle and release funds
    function checkMilestones(uint256 tokenId) external {
        Escrow storage escrowData = escrows[tokenId];
        require(escrowData.totalAmount > 0, "No funds in escrow");
        require(escrowData.currentPhase < 3, "All funds already released");

        uint256 currentScore = oracle.getNDVIScore(tokenId);
        uint256 targetScore = escrowData.targetNDVIScore;
        uint256 halfTarget = targetScore / 2;

        if (escrowData.currentPhase == 1 && currentScore >= halfTarget) {
            uint256 phase2Amount = (escrowData.totalAmount * 30) / 100;
            escrowData.currentPhase = 2;
            
            require(paymentToken.transfer(escrowData.worker, phase2Amount), "Transfer failed");
            nftContract.updateForestState(tokenId, ForestNFT.ForestState.Growing);
            emit FundsReleased(tokenId, escrowData.worker, phase2Amount, 2);
        }

        if (escrowData.currentPhase == 2 && currentScore >= targetScore) {
            uint256 upfront = (escrowData.totalAmount * 30) / 100;
            uint256 phase2Amount = (escrowData.totalAmount * 30) / 100;
            uint256 finalAmount = escrowData.totalAmount - upfront - phase2Amount;
            
            escrowData.currentPhase = 3;
            
            require(paymentToken.transfer(escrowData.worker, finalAmount), "Transfer failed");
            nftContract.updateForestState(tokenId, ForestNFT.ForestState.Verified);
            emit FundsReleased(tokenId, escrowData.worker, finalAmount, 3);
        }
    }
}
